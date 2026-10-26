import { hubertfaAligner } from "@/audio/alignment/hubertfa/hubertfa-aligner";
import {
  type AlignmentAssets,
  areAlignmentAssetsCached,
  resolveAlignmentAssets,
} from "@/audio/alignment/hubertfa/model-registry";
import type { Aligner } from "@/audio/alignment/types";
import { loadVocalsPcm } from "@/audio/alignment/vocals-pcm";
import { isModelHostingConfigured } from "@/audio/separation/model-registry";
import { DEFAULT_WINDOW_OPTIONS, alignmentWindow, sliceWindow } from "@/domain/alignment/window";
import { hasCjk } from "@/domain/alignment/cjk";
import { hanReadingFor, isSupportedLanguage } from "@/domain/alignment/language";
import { sungTransliteration } from "@/domain/alignment/transliteration";
import { retimeWords, sanitizeIntervals, timingsFromParts } from "@/domain/alignment/words";
import type { LineUpdate } from "@/domain/line/model";
import { type PlannedLine, isUnchanged, planLines } from "@/stores/alignment-plan";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { create } from "zustand";

// -- Types --------------------------------------------------------------------

type AlignmentStatus = "idle" | "downloading" | "running" | "error";

type AlignmentErrorCode = "unavailable" | "unsupported-language" | "needs-vocals" | "needs-model" | "failed";

interface AlignmentError {
  code: AlignmentErrorCode;
  message: string;
}

interface AlignmentResult {
  aligned: number;
  /** Lines edited while alignment ran; their new timing was not applied. */
  skipped: number;
  /** Lines the model couldn't place, split by character count instead. */
  fellBack: number;
  /** Words with no known pronunciation; their lines fell back. */
  unknownWords: string[];
  /** Words aligned on a pronunciation guessed from their spelling. */
  guessedWords: string[];
}

interface AlignOptions {
  /** Permission to download the alignment model if it isn't cached yet. */
  allowDownload?: boolean;
  /** Also redo lines that already have word timing, using their current span as the guide. */
  realign?: boolean;
}

interface AlignmentState {
  status: AlignmentStatus;
  progress: { done: number; total: number };
  error: AlignmentError | null;
  modelCached: boolean;
  /** Download size of the selected model and its dictionary, once resolved. */
  modelSizeMb: number | null;
}

interface AlignmentActions {
  /** Aligns the given lines, or every eligible line when omitted. */
  alignLines: (lineIds?: readonly string[], options?: AlignOptions) => Promise<AlignmentResult | null>;
  cancel: () => void;
  dismissError: () => void;
  refreshModelCached: (modelId?: string) => Promise<void>;
}

// -- State --------------------------------------------------------------------

let controller: AbortController | null = null;

// -- Functions ----------------------------------------------------------------

function selectedAssets(modelId = useSettingsStore.getState().alignmentModelId): Promise<AlignmentAssets | null> {
  return resolveAlignmentAssets(modelId);
}

// Auto-align shares the vocal separation model's host; without one it's hidden.
function isAutoAlignAvailable(): boolean {
  return isModelHostingConfigured();
}

function fail(set: (partial: Partial<AlignmentState>) => void, code: AlignmentErrorCode, message: string): null {
  set({ status: "error", error: { code, message }, progress: { done: 0, total: 0 } });
  return null;
}

function isAbortError(err: unknown): boolean {
  return (err as Error)?.name === "AbortError";
}

// -- Store --------------------------------------------------------------------

const useAlignmentStore = create<AlignmentState & AlignmentActions>((set, get) => ({
  status: "idle",
  progress: { done: 0, total: 0 },
  error: null,
  modelCached: false,
  modelSizeMb: null,

  refreshModelCached: async (modelId) => {
    const assets = await selectedAssets(modelId);
    set({ modelCached: await areAlignmentAssetsCached(assets), modelSizeMb: assets?.approxMb ?? null });
  },

  dismissError: () => {
    if (get().status === "error") set({ status: "idle", error: null });
  },

  alignLines: async (lineIds, options = {}) => {
    const status = get().status;
    if (status === "running" || status === "downloading") return null;
    const aligner: Aligner = hubertfaAligner;
    const project = useProjectStore.getState();
    const planned = planLines(project.lines, lineIds, options.realign ?? false);
    if (planned.length === 0) return { aligned: 0, skipped: 0, fellBack: 0, unknownWords: [], guessedWords: [] };
    // Claims the run and makes it cancellable before the first await.
    set({ status: "downloading", error: null, progress: { done: 0, total: 0 } });
    controller = new AbortController();
    const { signal } = controller;

    try {
      if (!(await selectedAssets())) return fail(set, "unavailable", "Auto-align isn't available on this deployment.");
      if (!isSupportedLanguage(project.metadata.language)) {
        return fail(set, "unsupported-language", "Auto-align supports English, Mandarin and Japanese lyrics.");
      }
      const hanReading = hanReadingFor(project.metadata.language, project.lines);
      const japanese = hanReading === "ja" && planned.some((p) => hasCjk(p.line.text));
      const vocalsUrl = useSeparationStore.getState().stemUrls.vocals;
      if (!vocalsUrl) {
        return fail(
          set,
          "needs-vocals",
          "Separate the vocals first. Alignment on the full mix is less accurate than tapping by hand.",
        );
      }
      if (!options.allowDownload && !(await areAlignmentAssetsCached(await selectedAssets()))) {
        return fail(set, "needs-model", "Auto-align needs a one-time model download.");
      }
      signal.throwIfAborted();
      const modelId = useSettingsStore.getState().alignmentModelId;
      await aligner.prepare((loaded, total) => set({ progress: { done: loaded, total } }), signal, {
        japanese,
        modelId,
      });
      set({ status: "running", modelCached: true, progress: { done: 0, total: planned.length } });
      const pcm = await loadVocalsPcm(vocalsUrl);
      const duration = pcm.samples.length / pcm.sampleRate;
      const updates: LineUpdate[] = [];
      const plannedById = new Map<string, PlannedLine>();
      const unknownWords = new Set<string>();
      const guessedWords = new Set<string>();
      let fellBack = 0;

      for (const plan of planned) {
        signal.throwIfAborted();
        const { line, taps, words, existing, previous } = plan;
        const window = alignmentWindow(taps, { ...DEFAULT_WINDOW_OPTIONS, duration, previous });
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- the worker aligns one line at a time, and progress and cancel follow each line
        const result = await aligner.align(
          {
            words,
            hanReading,
            transliteration: sungTransliteration(line),
            taps,
            windowBegin: window.begin,
            samples: sliceWindow(pcm.samples, pcm.sampleRate, window),
            sampleRate: pcm.sampleRate,
          },
          signal,
        );
        if (result.fellBack) fellBack++;
        for (const word of result.unknownWords) unknownWords.add(word);
        for (const word of result.guessedWords) guessedWords.add(word);
        const safe = sanitizeIntervals(result.intervals, window);
        const timings = existing ? retimeWords(existing, safe) : timingsFromParts(words, safe, result.splits);
        updates.push({ id: line.id, updates: { words: timings } });
        plannedById.set(line.id, plan);
        set({ progress: { done: updates.length, total: planned.length } });
      }

      signal.throwIfAborted();
      const latest = useProjectStore.getState();
      // Another project can share line ids and text (a duplicate, a re-import); this run's timing isn't its.
      if (latest.projectSession !== project.projectSession) throw new DOMException("Project changed", "AbortError");
      const currentById = new Map(latest.lines.map((l) => [l.id, l]));
      const applicable = updates.filter((u) => isUnchanged(currentById.get(u.id), plannedById.get(u.id)!));
      if (applicable.length > 0) {
        // Timing only: deriving text would drop the untimed words of partly synced lines.
        latest.updateLinesWithHistory(applicable, { deriveText: false });
        // Lines are tapped in Line mode; once they have word timing, refine words.
        latest.setGranularity("word");
      }
      set({ status: "idle", progress: { done: 0, total: 0 } });
      return {
        aligned: applicable.length,
        skipped: updates.length - applicable.length,
        fellBack,
        unknownWords: [...unknownWords],
        guessedWords: [...guessedWords],
      };
    } catch (err) {
      if (isAbortError(err) || signal.aborted) {
        set({ status: "idle", progress: { done: 0, total: 0 } });
        return null;
      }
      return fail(set, "failed", (err as Error).message);
    } finally {
      // Free the model (and its GPU memory) between runs unless asked to keep it; the download stays cached.
      if (get().status !== "idle" || !useSettingsStore.getState().keepAlignmentModelLoaded) aligner.release();
      if (controller?.signal === signal) controller = null;
    }
  },

  cancel: () => controller?.abort(),
}));

// A model kept loaded is freed once the setting is turned off, unless a run is using it.
useSettingsStore.subscribe((s, prev) => {
  if (prev.keepAlignmentModelLoaded && !s.keepAlignmentModelLoaded && !controller) hubertfaAligner.release();
});

// -- Exports ------------------------------------------------------------------

export { isAutoAlignAvailable, useAlignmentStore };
