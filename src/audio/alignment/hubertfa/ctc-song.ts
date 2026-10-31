import { CTC_BLANK, type CtcEmissions } from "@/audio/alignment/hubertfa/ctc-viterbi";

// The whole song's CTC posteriors, from overlapping chunks: each frame is taken
// from the chunk whose centre is nearest, as in the tap-free study
// (hubertfa-posttrain's tapfree_eval.song_ctc_logits).

// -- Types --------------------------------------------------------------------

interface CtcChunk {
  /** First frame of the chunk in the song. */
  start: number;
  /** Frames of the chunk; the model sees `frames * hop` samples from `start * hop`. */
  frames: number;
  /** Song frames [keepFrom, keepTo) taken from this chunk. */
  keepFrom: number;
  keepTo: number;
}

// -- Constants ----------------------------------------------------------------

// The study ran 30 s chunks every 20 s. Runs that long hang Intel iGPUs on
// Linux while the page draws: i915 resets the context when a compute batch
// doesn't yield to the compositor within its preemption timeout, and the
// worker falls back to the CPU. 7.5 s chunks kept a Gen9 iGPU running under
// an animating page, are as fast per second of audio, and placed one test
// song's lines as well. The two-thirds hop keeps at least 1.25 s of context on
// each side of every frame.
const CHUNK_SECONDS = 7.5;
const CHUNK_HOP_SECONDS = (CHUNK_SECONDS * 2) / 3;

// -- Functions ----------------------------------------------------------------

function songFrames(numSamples: number, hopSize: number): number {
  return Math.floor((numSamples + 0.5) / hopSize);
}

function ctcChunks(
  totalFrames: number,
  frameSeconds: number,
  chunkSeconds = CHUNK_SECONDS,
  hopSeconds = CHUNK_HOP_SECONDS,
) {
  const chunkFrames = Math.round(chunkSeconds / frameSeconds);
  const hopFrames = Math.round(hopSeconds / frameSeconds);
  const starts: number[] = [];
  if (totalFrames <= chunkFrames) starts.push(0);
  else {
    for (let s = 0; s < totalFrames - chunkFrames; s += hopFrames) starts.push(s);
    starts.push(totalFrames - chunkFrames);
  }
  const frames = starts.map((s) => Math.min(chunkFrames, totalFrames - s));
  const centres = starts.map((s, k) => s + frames[k] / 2);
  const cuts = [0, ...centres.slice(1).map((c, k) => Math.round((centres[k] + c) / 2)), totalFrames];
  return starts.map((start, k): CtcChunk => ({ start, frames: frames[k], keepFrom: cuts[k], keepTo: cuts[k + 1] }));
}

/**
 * Writes one chunk's kept frames into `out` ([frames, classes], class c being
 * vocab id `classIds[c]`), log-softmaxed over those classes only: the blank
 * and the song's own phones. `logits` is the model's `ctc_logits`, [vocab, n].
 * A model output a frame short repeats its last frame.
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

/** The CTC classes for a song: the blank first, then its phones' vocab ids, each once. */
function ctcClasses(phoneIds: Iterable<number>): Int32Array {
  const ids = [...new Set(phoneIds)].filter((id) => id !== CTC_BLANK).sort((a, b) => a - b);
  return Int32Array.from([CTC_BLANK, ...ids]);
}

// -- Exports ------------------------------------------------------------------

export { ctcChunks, ctcClasses, songFrames, writeChunkLogProbs };
