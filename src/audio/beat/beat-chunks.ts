import { N_MELS } from "@/audio/beat/beat-features";

// Chunking of CPJKU/beat_this inference.py (split_piece and aggregate_prediction, keep_first).

// -- Constants -----------------------------------------------------------------

const BEAT_CHUNK_FRAMES = 1500;
const BEAT_CHUNK_BORDER = 6;
const EMPTY_LOGIT = -1000;

// -- Types ---------------------------------------------------------------------

interface ChunkInput {
  input: Float32Array;
  frames: number;
}

interface ChunkLogits {
  beat: Float32Array;
  downbeat: Float32Array;
}

// -- Chunks --------------------------------------------------------------------

function chunkStarts(frames: number): number[] {
  const step = BEAT_CHUNK_FRAMES - 2 * BEAT_CHUNK_BORDER;
  const starts: number[] = [];
  for (let start = -BEAT_CHUNK_BORDER; start < frames - BEAT_CHUNK_BORDER; start += step) starts.push(start);
  if (frames > step) starts[starts.length - 1] = frames - (BEAT_CHUNK_FRAMES - BEAT_CHUNK_BORDER);
  return starts;
}

function chunkInput(mel: Float32Array, frames: number, start: number): ChunkInput {
  const from = Math.max(start, 0);
  const to = Math.min(start + BEAT_CHUNK_FRAMES, frames);
  const left = Math.max(0, -start);
  const right = Math.max(0, Math.min(BEAT_CHUNK_BORDER, start + BEAT_CHUNK_FRAMES - frames));
  const length = left + (to - from) + right;
  const input = new Float32Array(length * N_MELS);
  input.set(mel.subarray(from * N_MELS, to * N_MELS), left * N_MELS);
  return { input, frames: length };
}

function mergeChunkLogits(chunks: readonly ChunkLogits[], starts: readonly number[], frames: number): ChunkLogits {
  const beat = new Float32Array(frames).fill(EMPTY_LOGIT);
  const downbeat = new Float32Array(frames).fill(EMPTY_LOGIT);
  for (let c = chunks.length - 1; c >= 0; c--) {
    const chunk = chunks[c];
    const end = chunk.beat.length - BEAT_CHUNK_BORDER;
    for (let i = BEAT_CHUNK_BORDER; i < end; i++) {
      const frame = starts[c] + i;
      if (frame < 0 || frame >= frames) continue;
      beat[frame] = chunk.beat[i];
      downbeat[frame] = chunk.downbeat[i];
    }
  }
  return { beat, downbeat };
}

// -- Exports -------------------------------------------------------------------

export { BEAT_CHUNK_BORDER, chunkInput, chunkStarts, mergeChunkLogits };
export type { ChunkLogits };
