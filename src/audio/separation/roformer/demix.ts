import { reflectPad } from "@/audio/separation/stft";
import { RF_CHUNK } from "@/audio/separation/roformer/spec";

// MSST's `demix` in its generic mode, with the KJ config's 2 overlaps and batch size 4. The model never sees a
// batch here, but MSST picks the fade window once per batch of 4, and the stems this reproduces were made that way:
// every chunk of the first batch keeps its fade-in unless the song is one chunk long, and every chunk of the last
// batch loses its fade-out.

// -- Constants ----------------------------------------------------------------

const NUM_OVERLAP = 2;
const MSST_BATCH = 4;
const STEP = RF_CHUNK / NUM_OVERLAP;
const BORDER = RF_CHUNK - STEP;
const FADE = Math.floor(RF_CHUNK / 10);

// -- Types --------------------------------------------------------------------

interface DemixPlan {
  /** Reflect padding added to both ends of the song. */
  pad: number;
  /** Chunk starts in the padded song. */
  starts: number[];
  /** The fade window each chunk is weighted by. */
  windows: Float32Array[];
}

interface DemixChunk {
  channels: Float32Array[];
  /** Song samples in the chunk; the rest is padding. */
  length: number;
}

interface DemixSum {
  sum: Float32Array[];
  weight: Float32Array;
}

// -- Planning -----------------------------------------------------------------

function fadeWindows(): { both: Float32Array; noFadeIn: Float32Array; noFadeOut: Float32Array } {
  const both = new Float32Array(RF_CHUNK).fill(1);
  for (let i = 0; i < FADE; i++) {
    both[i] = i / (FADE - 1);
    both[RF_CHUNK - FADE + i] = 1 - i / (FADE - 1);
  }
  const noFadeIn = both.slice();
  noFadeIn.fill(1, 0, FADE);
  const noFadeOut = both.slice();
  noFadeOut.fill(1, RF_CHUNK - FADE);
  return { both, noFadeIn, noFadeOut };
}

function demixPlan(frames: number): DemixPlan {
  const pad = frames > 2 * BORDER ? BORDER : 0;
  const total = frames + 2 * pad;
  const starts: number[] = [];
  for (let start = 0; start < total; start += STEP) starts.push(start);
  const { both, noFadeIn, noFadeOut } = fadeWindows();
  const windows: Float32Array[] = [];
  for (let first = 0; first < starts.length; first += MSST_BATCH) {
    const batch = starts.slice(first, first + MSST_BATCH);
    const last = batch[batch.length - 1];
    const window = last === 0 ? noFadeIn : last + STEP >= total ? noFadeOut : both;
    for (let k = 0; k < batch.length; k++) windows.push(window);
  }
  return { pad, starts, windows };
}

function padSong(channels: readonly Float32Array[], pad: number): Float32Array[] {
  return channels.map((channel) => (pad > 0 ? reflectPad(channel, pad, pad) : channel));
}

// A short last chunk is reflect-padded when it holds more than half a chunk, and zero-padded otherwise.
function chunkAt(padded: readonly Float32Array[], start: number): DemixChunk {
  const length = Math.min(RF_CHUNK, padded[0].length - start);
  const channels = padded.map((channel) => {
    const part = new Float32Array(RF_CHUNK);
    part.set(channel.subarray(start, start + length));
    if (length < RF_CHUNK && length > RF_CHUNK / 2) {
      for (let j = 0; length + j < RF_CHUNK; j++) part[length + j] = part[length - 2 - j];
    }
    return part;
  });
  return { channels, length };
}

// -- Stitching ----------------------------------------------------------------

function demixSum(paddedFrames: number, channelCount: number): DemixSum {
  return {
    sum: Array.from({ length: channelCount }, () => new Float32Array(paddedFrames)),
    weight: new Float32Array(paddedFrames),
  };
}

function addChunk(acc: DemixSum, vocals: readonly Float32Array[], start: number, length: number, window: Float32Array) {
  vocals.forEach((channel, c) => {
    const sum = acc.sum[c];
    for (let j = 0; j < length; j++) sum[start + j] += channel[j] * window[j];
  });
  for (let j = 0; j < length; j++) acc.weight[start + j] += window[j];
}

// Samples no window reaches (a zero weight) come out silent, as MSST's nan_to_num leaves them.
function finishDemix(acc: DemixSum, pad: number, frames: number): Float32Array[] {
  return acc.sum.map((sum) => {
    const out = new Float32Array(frames);
    for (let j = 0; j < frames; j++) {
      const weight = acc.weight[pad + j];
      out[j] = weight > 0 ? sum[pad + j] / weight : 0;
    }
    return out;
  });
}

// -- Exports ------------------------------------------------------------------

export { addChunk, chunkAt, demixPlan, demixSum, finishDemix, padSong };
