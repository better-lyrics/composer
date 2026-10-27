import type { AlignOutcome } from "@/audio/alignment/hubertfa/worker";
import { resolveAlignmentAssets } from "@/audio/alignment/hubertfa/model-registry";
import { AlignmentWorker } from "@/audio/alignment/hubertfa/worker-host";
import { splitByCharacters } from "@/audio/alignment/split-by-characters";
import type { Aligner } from "@/audio/alignment/types";
import type { WordInterval } from "@/domain/alignment/words";

// -- State --------------------------------------------------------------------

let worker: AlignmentWorker | null = null;
// What the loaded worker was set up with, so a kept model is only reused when it fits the run.
let loaded: { modelId: string; japanese: boolean } | null = null;

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
    signal.throwIfAborted();
    if (!worker) throw new Error("Alignment model is not loaded.");
    const parts = segment.words.map((word) => word.parts);
    // A WebGPU failure can start a fresh model download mid-run, which Cancel must stop.
    const active = worker;
    const onAbort = () => active.cancel();
    signal.addEventListener("abort", onAbort);
    let outcome: AlignOutcome;
    try {
      outcome = await active.align(
        segment.samples,
        segment.sampleRate,
        parts,
        segment.hanReading,
        segment.transliteration,
      );
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
    if (outcome.kind === "aligned") {
      const toSong = (iv: WordInterval) => ({
        begin: segment.windowBegin + iv.begin,
        end: segment.windowBegin + iv.end,
      });
      const intervals = outcome.intervals.map(toSong);
      const splits = outcome.splits.map((split) => ({ ...split, intervals: split.intervals.map(toSong) }));
      return { intervals, fellBack: false, unknownWords: [], guessedWords: outcome.guessed, splits };
    }
    return {
      intervals: splitByCharacters(segment),
      fellBack: true,
      unknownWords: outcome.kind === "unknown" ? outcome.words : [],
      guessedWords: [],
      splits: [],
    };
  },

  release: () => {
    worker?.dispose();
    worker = null;
    loaded = null;
  },
};

// -- Exports ------------------------------------------------------------------

export { hubertfaAligner };
