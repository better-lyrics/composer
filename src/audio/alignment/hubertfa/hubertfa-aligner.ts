import { AlignmentWorker } from "@/audio/alignment/hubertfa/worker-host";
import { splitByCharacters } from "@/audio/alignment/split-by-characters";
import type { Aligner } from "@/audio/alignment/types";

// -- State --------------------------------------------------------------------

let worker: AlignmentWorker | null = null;

// -- Aligner ------------------------------------------------------------------

// HubertFA forced alignment on the separated vocals, run in a worker. Lines it
// can't place (unknown words, no path through the audio) get the character
// split, and the caller is told which.
const hubertfaAligner: Aligner = {
  id: "hubertfa",
  listensToAudio: true,

  prepare: async (onProgress, signal, { japanese }) => {
    if (worker) return;
    const next = new AlignmentWorker();
    const onAbort = () => next.cancel();
    signal.addEventListener("abort", onAbort);
    try {
      await next.init(onProgress, japanese);
      worker = next;
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
    const outcome = await worker.align(segment.samples, segment.sampleRate, parts, segment.hanReading);
    if (outcome.kind === "aligned") {
      const intervals = outcome.intervals.map((iv) => ({
        begin: segment.windowBegin + iv.begin,
        end: segment.windowBegin + iv.end,
      }));
      return { intervals, fellBack: false, unknownWords: [] };
    }
    return {
      intervals: splitByCharacters(segment),
      fellBack: true,
      unknownWords: outcome.kind === "unknown" ? outcome.words : [],
    };
  },

  release: () => {
    worker?.dispose();
    worker = null;
  },
};

// -- Exports ------------------------------------------------------------------

export { hubertfaAligner };
