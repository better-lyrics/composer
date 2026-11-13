import { create } from "zustand";
import { hubertfaAligner } from "@/audio/alignment/hubertfa/hubertfa-aligner";
import { areAlignmentAssetsCached, resolveAlignmentAssets } from "@/audio/alignment/hubertfa/model-registry";
import type { Aligner } from "@/audio/alignment/types";
import { loadVocalsPcm } from "@/audio/alignment/vocals-pcm";
import { isModelHostingConfigured } from "@/audio/separation/model-registry";
import type { AnchorChain } from "@/domain/alignment/anchor";
import { hasCjk } from "@/domain/alignment/cjk";
import { canAlignLanguage, hanReadingFor, songLanguage } from "@/domain/alignment/language";
import { newSyllableGroups, retimeInnerBoundaries } from "@/domain/alignment/syllable-retime";
import { sanitizeIntervals } from "@/domain/alignment/words";
import { applyAlignedTimings, retimeNewSyllables } from "@/domain/commands/alignment";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { alignLine, isAbortError } from "@/stores/alignment-line";
import {
  type AlignedWords,
  alignedUpdates,
  movesExistingWords,
  type PlannedLine,
  planLines,
  segmentFor,
} from "@/stores/alignment-plan";
import { recordRealignedLines } from "@/stores/alignment-record";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";

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
  modelSizeBytes: number | null;
}

interface AlignmentActions {
  /** Aligns the given lines, or every eligible line when omitted. */
  alignLines: (lineIds?: readonly string[], options?: AlignOptions) => Promise<AlignmentResult | null>;
  cancel: () => void;
  dismissError: () => void;
  refreshModelCached: (modelId?: string) => Promise<void>;
  /**
   * Times the syllables of words split since `before`, when the model is
   * already loaded. Only the boundaries inside each split word move.
   */
  retimeNewSyllables: (before: readonly LyricLine[]) => Promise<void>;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[alignment]";

// -- State --------------------------------------------------------------------

let controller: AbortController | null = null;

// -- Functions ----------------------------------------------------------------

// Auto-align shares the vocal separation model's host; without one it's hidden.
function isAutoAlignAvailable(): boolean {
  return isModelHostingConfigured();
}

function fail(set: (partial: Partial<AlignmentState>) => void, code: AlignmentErrorCode, message: string): null {
  set({ status: "error", error: { code, message }, progress: { done: 0, total: 0 } });
  return null;
}

// -- Store --------------------------------------------------------------------

const useAlignmentStore = create<AlignmentState & AlignmentActions>((set, get) => ({
  status: "idle",
  progress: { done: 0, total: 0 },
  error: null,
  modelCached: false,
  modelSizeBytes: null,

  refreshModelCached: async (modelId) => {
    const assets = await resolveAlignmentAssets(modelId ?? useSettingsStore.getState().alignmentModelId);
    set({ modelCached: await areAlignmentAssetsCached(assets), modelSizeBytes: assets?.approxBytes ?? null });
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
    // One model for the whole run, even if the setting changes while it starts.
    const modelId = useSettingsStore.getState().alignmentModelId;

    try {
      const assets = await resolveAlignmentAssets(modelId);
      if (!assets) return fail(set, "unavailable", "Auto-align isn't available on this deployment.");
      if (!canAlignLanguage(project.metadata.language, assets.languages)) {
        return fail(set, "unsupported-language", "The alignment model doesn't cover this song's language.");
      }
      const hanReading = hanReadingFor(project.metadata.language, project.lines);
      const japanese = hanReading === "ja" && planned.some((p) => hasCjk(lineText(p.line)));
      const vocalsUrl = useSeparationStore.getState().stemUrls.vocals;
      if (!vocalsUrl) {
        return fail(
          set,
          "needs-vocals",
          "Separate the vocals first. Alignment on the full mix is less accurate than tapping by hand.",
        );
      }
      if (!options.allowDownload && !(await areAlignmentAssetsCached(assets))) {
        return fail(set, "needs-model", "Auto-align needs a one-time model download.");
      }
      signal.throwIfAborted();
      await aligner.prepare((loaded, total) => set({ progress: { done: loaded, total } }), signal, {
        japanese,
        modelId,
      });
      set({ status: "running", modelCached: true, progress: { done: 0, total: planned.length } });
      const pcm = await loadVocalsPcm(vocalsUrl);
      const aligned: AlignedWords[] = [];
      const plannedById = new Map<string, PlannedLine>();
      const unknownWords = new Set<string>();
      const guessedWords = new Set<string>();
      let fellBack = 0;

      const anchors = songLanguage(project.metadata.language, project.lines) === "en";
      let chain: AnchorChain | null = null;
      for (const [index, plan] of planned.entries()) {
        signal.throwIfAborted();
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- lines align in order: each may anchor on the one before
        const { result, timings, ...next } = await alignLine(
          plan,
          { aligner, pcm, hanReading, signal, anchors },
          chain,
        );
        chain = next.chain;
        for (const word of result.unknownWords) unknownWords.add(word);
        for (const word of result.guessedWords) guessedWords.add(word);
        if (timings) {
          if (result.fellBack) fellBack++;
          aligned.push({ id: plan.line.id, words: timings });
          plannedById.set(plan.line.id, plan);
        }
        set({ progress: { done: index + 1, total: planned.length } });
      }

      signal.throwIfAborted();
      const latest = useProjectStore.getState();
      // Another project can share line ids and text (a duplicate, a re-import); this run's timing isn't its.
      if (latest.projectSession !== project.projectSession) throw new DOMException("Project changed", "AbortError");
      const currentById = new Map(latest.lines.map((l) => [l.id, l]));
      const applicable = alignedUpdates(aligned, currentById, plannedById);
      if (applicable.length > 0) {
        latest.commit(applyAlignedTimings(applicable));
        // Shared group copies change in the same write; linked siblings may be replaced with their timing unchanged.
        recordRealignedLines(currentById);
        // Lines are tapped in Line mode; once they have word timing, refine words.
        latest.setGranularity("word");
      }
      set({ status: "idle", progress: { done: 0, total: 0 } });
      return {
        aligned: applicable.length,
        skipped: aligned.length - applicable.length,
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

  retimeNewSyllables: async (before) => {
    const status = get().status;
    if (status === "running" || status === "downloading") return;
    const aligner: Aligner = hubertfaAligner;
    const project = useProjectStore.getState();
    // The split's own history step, which the new timing joins if nothing has happened since.
    const step = project.history[project.historyIndex];
    const beforeById = new Map(before.map((line) => [line.id, line]));
    const groupsOf = new Map(
      project.lines.flatMap((line) => {
        const previous = beforeById.get(line.id);
        const was = previous && timedSyllables(mainTrack(previous));
        const words = timedSyllables(mainTrack(line));
        const groups = words.length > 0 && words !== was ? newSyllableGroups(was, words) : [];
        return groups.length > 0 ? [[line.id, groups] as const] : [];
      }),
    );
    const planned = planLines(project.lines, [...groupsOf.keys()], true);
    const hanReading = hanReadingFor(project.metadata.language, project.lines);
    const japanese = hanReading === "ja" && planned.some((p) => hasCjk(lineText(p.line)));
    const vocalsUrl = useSeparationStore.getState().stemUrls.vocals;
    const modelId = useSettingsStore.getState().alignmentModelId;
    // A split never starts a model load; this only runs with one kept in memory.
    if (planned.length === 0 || !vocalsUrl || !aligner.isLoaded({ japanese, modelId })) return;
    set({ status: "running", error: null, progress: { done: 0, total: planned.length } });
    controller = new AbortController();
    const { signal } = controller;
    try {
      const assets = await resolveAlignmentAssets(modelId);
      if (!assets || !canAlignLanguage(project.metadata.language, assets.languages)) return;
      const pcm = await loadVocalsPcm(vocalsUrl);
      const retimed: AlignedWords[] = [];
      for (const plan of planned) {
        signal.throwIfAborted();
        const { segment, window } = segmentFor(plan, hanReading, pcm);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- the worker aligns one line at a time, and cancel follows each line
        const result = await aligner.align(segment, signal);
        const intervals = sanitizeIntervals(result.intervals, window);
        const groups = groupsOf.get(plan.line.id) ?? [];
        if (!result.fellBack) {
          retimed.push({ id: plan.line.id, words: retimeInnerBoundaries(plan.existing!, groups, intervals) });
        }
        set({ progress: { done: planned.indexOf(plan) + 1, total: planned.length } });
      }
      signal.throwIfAborted();
      const latest = useProjectStore.getState();
      if (latest.projectSession !== project.projectSession) return;
      const currentById = new Map(latest.lines.map((l) => [l.id, l]));
      const plannedById = new Map(planned.map((p) => [p.line.id, p]));
      const applicable = alignedUpdates(retimed, currentById, plannedById, movesExistingWords);
      // Part of the split, so one undo takes back both; anything done since leaves the split as it was.
      if (latest.isCurrentStep(step) && applicable.length > 0) latest.commit(retimeNewSyllables(applicable), "amend");
    } catch (err) {
      if (!isAbortError(err) && !signal.aborted) {
        console.warn(`${LOG_PREFIX} could not time the new syllables`, err);
        aligner.release();
      }
    } finally {
      set({ status: "idle", progress: { done: 0, total: 0 } });
      if (!useSettingsStore.getState().keepAlignmentModelLoaded) aligner.release();
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

export type { AlignmentError, AlignmentErrorCode };
export { isAutoAlignAvailable, useAlignmentStore };
