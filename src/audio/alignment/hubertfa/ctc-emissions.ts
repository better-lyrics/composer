import { CTC_BLANK, type CtcEmissions } from "@/audio/alignment/hubertfa/ctc-viterbi";

// The model's `ctc_logits` as log-probabilities over a restricted set of
// classes: the blank and the phones being aligned. hubertfa-posttrain's
// ctc_bounds and tapfree_eval softmax over that set only.

// -- Types --------------------------------------------------------------------

interface CtcChunk {
  /** First frame of the chunk in the output. */
  start: number;
  /** Frames of the chunk; the model sees `frames * hop` samples from `start * hop`. */
  frames: number;
  /** Output frames [keepFrom, keepTo) taken from this chunk. */
  keepFrom: number;
  keepTo: number;
}

// -- Functions ----------------------------------------------------------------

/**
 * Writes one chunk's kept frames into `out` ([frames, classes], class c being
 * vocab id `classIds[c]`), log-softmaxed over those classes only. `logits` is
 * the model's `ctc_logits`, [vocab, n]. A model output a frame short repeats
 * its last frame.
 */
function writeChunkLogProbs(
  out: CtcEmissions,
  classIds: Int32Array,
  chunk: CtcChunk,
  logits: Float32Array,
  outputFrames: number,
): void {
  const K = classIds.length;
  const row = new Float64Array(K);
  for (let t = chunk.keepFrom; t < chunk.keepTo; t++) {
    const local = Math.min(t - chunk.start, outputFrames - 1);
    let max = Number.NEGATIVE_INFINITY;
    for (let c = 0; c < K; c++) {
      row[c] = logits[classIds[c] * outputFrames + local];
      if (row[c] > max) max = row[c];
    }
    let sum = 0;
    for (let c = 0; c < K; c++) sum += Math.exp(row[c] - max);
    const logSum = max + Math.log(sum);
    for (let c = 0; c < K; c++) out.logProbs[t * K + c] = row[c] - logSum;
  }
}

/** The CTC classes for a set of phones: the blank first, then their vocab ids, each once. */
function ctcClasses(phoneIds: Iterable<number>): Int32Array {
  const ids = [...new Set(phoneIds)].filter((id) => id !== CTC_BLANK).sort((a, b) => a - b);
  return Int32Array.from([CTC_BLANK, ...ids]);
}

// -- Exports ------------------------------------------------------------------

export { ctcClasses, writeChunkLogProbs };
