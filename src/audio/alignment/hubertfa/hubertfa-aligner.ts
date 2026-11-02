import type { LineRequest } from "@/audio/alignment/hubertfa/worker-protocol";
import { resolveAlignmentAssets } from "@/audio/alignment/hubertfa/model-registry";
import { AlignmentWorker } from "@/audio/alignment/hubertfa/worker-host";
import { releaseIdleRoformer } from "@/audio/separation/shared-separation-worker";
import { splitByCharacters } from "@/audio/alignment/split-by-characters";
import type { AlignmentSegment, Aligner } from "@/audio/alignment/types";
import type { WordInterval } from "@/domain/alignment/words";

// -- State --------------------------------------------------------------------

let worker: AlignmentWorker | null = null;
// What the loaded worker was set up with, so a kept model is only reused when it fits the run.
let loaded: { modelId: string; japanese: boolean } | null = null;

// -- Functions ----------------------------------------------------------------

function lineRequest(segment: AlignmentSegment): LineRequest {
  return {
    samples: segment.samples,
    sampleRate: segment.sampleRate,
    words: segment.words.map((word) => word.parts),
    hanReading: segment.hanReading,
    transliteration: segment.transliteration,
  };
}

// A WebGPU failure can start a fresh model download mid-run, which Cancel must stop.
async function withWorker<T>(signal: AbortSignal, run: (active: AlignmentWorker) => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  if (!worker) throw new Error("Alignment model is not loaded.");
  const active = worker;
  const onAbort = () => active.cancel();
  signal.addEventListener("abort", onAbort);
  try {
    return await run(active);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

// -- Aligner ------------------------------------------------------------------

// HubertFA forced alignment on the separated vocals, run in a worker. Lines it
// can't place (words it can't even guess, no path through the audio) get the
// character split, and the caller is told which.
const hubertfaAligner: Aligner = {
  id: "hubertfa",
  listensToAudio: true,

  isLoaded: ({ japanese, modelId }) => worker !== null && loaded?.modelId === modelId && (loaded.japanese || !japanese),

  prepare: async (onProgress, signal, options) => {
    if (hubertfaAligner.isLoaded(options)) return;
    const { japanese, modelId } = options;
    hubertfaAligner.release();
    // An idle RoFormer holds GPU memory the aligner needs; it reloads for the next song that's separated.
    await releaseIdleRoformer();
    const assets = await resolveAlignmentAssets(modelId);
    if (!assets) throw new Error("Auto-align isn't available on this deployment.");
    const next = new AlignmentWorker();
    const onAbort = () => next.cancel();
    signal.addEventListener("abort", onAbort);
    try {
      await next.init(assets, onProgress, japanese);
      worker = next;
      loaded = { modelId, japanese };
    } catch (err) {
      next.dispose();
      throw err;
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  },

  align: async (segment, signal) => {
    const outcome = await withWorker(signal, (active) => active.align(lineRequest(segment), segment.anchor ?? null));
    if (outcome.kind === "aligned") {
      const toSong = (iv: WordInterval) => ({
        begin: segment.windowBegin + iv.begin,
        end: segment.windowBegin + iv.end,
      });
      const intervals = outcome.intervals.map(toSong);
      const splits = outcome.splits.map((split) => ({ ...split, intervals: split.intervals.map(toSong) }));
      const anchor = outcome.anchor && toSong(outcome.anchor);
      return { intervals, fellBack: false, unknownWords: [], guessedWords: outcome.guessed, splits, anchor };
    }
    return {
      intervals: splitByCharacters(segment),
      fellBack: true,
      unknownWords: outcome.kind === "unknown" ? outcome.words : [],
      guessedWords: [],
      splits: [],
      anchor: null,
    };
  },

  locate: async (segment, signal) => {
    const bounds = await withWorker(signal, (active) => active.locate(lineRequest(segment)));
    return bounds && { begin: segment.windowBegin + bounds.begin, end: segment.windowBegin + bounds.end };
  },

  release: () => {
    worker?.dispose();
    worker = null;
    loaded = null;
  },
};

// -- Exports ------------------------------------------------------------------

export { hubertfaAligner };
