import { hubertfaAligner } from "@/audio/alignment/hubertfa/hubertfa-aligner";
import { getAlignmentAssets } from "@/audio/alignment/hubertfa/model-registry";
import type { Aligner } from "@/audio/alignment/types";
import { loadVocalsPcm } from "@/audio/alignment/vocals-pcm";
import { hasCachedModel } from "@/audio/separation/model-cache";
import { DEFAULT_WINDOW_OPTIONS, alignmentWindow, sliceWindow } from "@/domain/alignment/window";
import {
  type AlignmentWord,
  type WordInterval,
  groupAlignmentWords,
  groupTimedWords,
  retimeWords,
  sanitizeIntervals,
  wordTimingsFromAlignment,
} from "@/domain/alignment/words";
import { detectNonLatinLanguage } from "@/domain/language/script-detection";
import { mainBounds } from "@/domain/line/bounds";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";
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
}

interface AlignOptions {
  /** Permission to download the alignment model if it isn't cached yet. */
  allowDownload?: boolean;
  /** Also redo lines that already have word timing, using their current span as the guide. */
  realign?: boolean;
}

interface AlignableCounts {
  /** Lines with only line timing: what a first run aligns. */
  lineTimed: number;
  /** Lines that already have word timing: only aligned when re-aligning. */
  wordTimed: number;
}

interface AlignmentState {
  status: AlignmentStatus;
  progress: { done: number; total: number };
  error: AlignmentError | null;
  modelCached: boolean;
}

interface AlignmentActions {
  /** Aligns the given lines, or every eligible line when omitted. */
  alignLines: (lineIds?: readonly string[], options?: AlignOptions) => Promise<AlignmentResult | null>;
  cancel: () => void;
  dismissError: () => void;
  refreshModelCached: () => Promise<void>;
}

interface PlannedLine {
  line: LyricLine;
  taps: WordInterval;
  words: AlignmentWord[];
  /** The line's current word timing when re-aligning; its parts are kept and retimed. */
  existing: WordTiming[] | null;
  previous: WordInterval | null;
}

// -- State --------------------------------------------------------------------

let controller: AbortController | null = null;

// -- Functions ----------------------------------------------------------------

// The model is English-only for now. Most projects leave the language unset,
// so then the lyrics' script decides: anything non-Latin is refused.
function isSupportedLanguage(language: string | undefined, lines: readonly PlannedLine[]): boolean {
  if (language) return language.toLowerCase().split("-")[0] === "en";
  return !lines.some((p) => detectNonLatinLanguage(p.line.text) !== null);
}

async function isModelCached(): Promise<boolean> {
  const assets = getAlignmentAssets();
  if (!assets) return false;
  const [model, dictionary] = await Promise.all([hasCachedModel(assets.model), hasCachedModel(assets.dictionary)]);
  return model && dictionary;
}

function alignmentModelSizeMb(): number | null {
  return getAlignmentAssets()?.approxMb ?? null;
}

// Auto-align shares the vocal separation model's host; without one it's hidden.
function isAutoAlignAvailable(): boolean {
  return getAlignmentAssets() !== null;
}

function fail(set: (partial: Partial<AlignmentState>) => void, code: AlignmentErrorCode, message: string): null {
  set({ status: "error", error: { code, message }, progress: { done: 0, total: 0 } });
  return null;
}

function planLine(line: LyricLine, realign: boolean): Pick<PlannedLine, "taps" | "words" | "existing"> | null {
  if (isLineSynced(line)) {
    if (line.end <= line.begin) return null;
    const { parts, trailingSpace } = splitIntoWordsWithMeta(line.text);
    if (parts.length === 0) return null;
    return {
      taps: { begin: line.begin, end: line.end },
      words: groupAlignmentWords(parts, trailingSpace),
      existing: null,
    };
  }
  if (realign && isWordSynced(line)) {
    const taps = mainBounds(line);
    if (!taps || taps.end <= taps.begin) return null;
    return { taps, words: groupTimedWords(line.words!), existing: line.words! };
  }
  return null;
}

function planLines(lines: readonly LyricLine[], lineIds: readonly string[] | undefined, realign: boolean) {
  const wanted = lineIds ? new Set(lineIds) : null;
  const planned: PlannedLine[] = [];
  let previous: WordInterval | null = null;
  for (const line of lines) {
    const bounds = mainBounds(line);
    const plan = !wanted || wanted.has(line.id) ? planLine(line, realign) : null;
    if (plan) planned.push({ line, ...plan, previous });
    if (bounds) previous = bounds;
  }
  return planned;
}

function countAlignableLines(lines: readonly LyricLine[], lineIds?: readonly string[]): AlignableCounts {
  const all = planLines(lines, lineIds, true);
  const lineTimed = all.filter((p) => p.existing === null).length;
  return { lineTimed, wordTimed: all.length - lineTimed };
}

// A line the user retimed or retyped mid-run keeps their edit. The store
// replaces a line's object (and its words array) on every change.
function isUnchanged(current: LyricLine | undefined, planned: PlannedLine): boolean {
  if (!current || current.text !== planned.line.text) return false;
  if (planned.existing) return current.words === planned.existing;
  return isLineSynced(current) && current.begin === planned.taps.begin && current.end === planned.taps.end;
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

  refreshModelCached: async () => set({ modelCached: await isModelCached() }),

  dismissError: () => {
    if (get().status === "error") set({ status: "idle", error: null });
  },

  alignLines: async (lineIds, options = {}) => {
    const status = get().status;
    if (status === "running" || status === "downloading") return null;
    const aligner: Aligner = hubertfaAligner;
    const project = useProjectStore.getState();
    const planned = planLines(project.lines, lineIds, options.realign ?? false);
    if (planned.length === 0) return { aligned: 0, skipped: 0, fellBack: 0, unknownWords: [] };

    if (!getAlignmentAssets()) return fail(set, "unavailable", "Auto-align isn't available on this deployment.");
    if (!isSupportedLanguage(project.metadata.language, planned)) {
      return fail(set, "unsupported-language", "Auto-align only supports English lyrics for now.");
    }
    const vocalsUrl = useSeparationStore.getState().stemUrls.vocals;
    if (!vocalsUrl) {
      return fail(
        set,
        "needs-vocals",
        "Separate the vocals first. Alignment on the full mix is less accurate than tapping by hand.",
      );
    }
    if (!options.allowDownload && !(await isModelCached())) {
      return fail(set, "needs-model", "Auto-align needs a one-time model download.");
    }

    controller = new AbortController();
    const { signal } = controller;
    set({ status: "downloading", error: null, progress: { done: 0, total: 0 } });

    try {
      await aligner.prepare((loaded, total) => set({ progress: { done: loaded, total } }), signal);
      set({ status: "running", modelCached: true, progress: { done: 0, total: planned.length } });
      const pcm = await loadVocalsPcm(vocalsUrl);
      const duration = pcm.samples.length / pcm.sampleRate;
      const updates: LineUpdate[] = [];
      const plannedById = new Map<string, PlannedLine>();
      const unknownWords = new Set<string>();
      let fellBack = 0;

      for (const plan of planned) {
        signal.throwIfAborted();
        const { line, taps, words, existing, previous } = plan;
        const window = alignmentWindow(taps, { ...DEFAULT_WINDOW_OPTIONS, duration, previous });
        const result = await aligner.align(
          {
            words: words.map((w) => w.text),
            taps,
            windowBegin: window.begin,
            samples: sliceWindow(pcm.samples, pcm.sampleRate, window),
            sampleRate: pcm.sampleRate,
          },
          signal,
        );
        if (result.fellBack) fellBack++;
        for (const word of result.unknownWords) unknownWords.add(word);
        const safe = sanitizeIntervals(result.intervals, window);
        const timings = existing ? retimeWords(existing, words, safe) : wordTimingsFromAlignment(words, safe);
        updates.push({ id: line.id, updates: { words: timings } });
        plannedById.set(line.id, plan);
        set({ progress: { done: updates.length, total: planned.length } });
      }

      const latest = useProjectStore.getState();
      const currentById = new Map(latest.lines.map((l) => [l.id, l]));
      const applicable = updates.filter((u) => isUnchanged(currentById.get(u.id), plannedById.get(u.id)!));
      if (applicable.length > 0) {
        latest.updateLinesWithHistory(applicable);
        // Lines are tapped in Line mode; once they have word timing, refine words.
        latest.setGranularity("word");
      }
      set({ status: "idle", progress: { done: 0, total: 0 } });
      return {
        aligned: applicable.length,
        skipped: updates.length - applicable.length,
        fellBack,
        unknownWords: [...unknownWords],
      };
    } catch (err) {
      if (isAbortError(err) || signal.aborted) {
        set({ status: "idle", progress: { done: 0, total: 0 } });
        return null;
      }
      return fail(set, "failed", (err as Error).message);
    } finally {
      // Free the model (and its GPU memory) between runs; the download stays cached.
      aligner.release();
      if (controller?.signal === signal) controller = null;
    }
  },

  cancel: () => controller?.abort(),
}));

// -- Exports ------------------------------------------------------------------

export { alignmentModelSizeMb, countAlignableLines, isAutoAlignAvailable, useAlignmentStore };
