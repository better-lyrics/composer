import { BEAT_FPS } from "@/audio/beat/beat-features";
import type { DetectedBeats } from "@/domain/tempo/beat-grid";

// The "minimal" postprocessor of CPJKU/beat_this (model/postprocessor.py).

// -- Constants -----------------------------------------------------------------

const PEAK_RADIUS_FRAMES = 3;
const PEAK_MERGE_FRAMES = 1;

// -- Peaks ---------------------------------------------------------------------

function isLocalMax(logits: Float32Array, frame: number): boolean {
  const from = Math.max(0, frame - PEAK_RADIUS_FRAMES);
  const to = Math.min(logits.length - 1, frame + PEAK_RADIUS_FRAMES);
  for (let k = from; k <= to; k++) if (logits[k] > logits[frame]) return false;
  return true;
}

function peakFrames(logits: Float32Array): number[] {
  const raw: number[] = [];
  for (let frame = 0; frame < logits.length; frame++) {
    if (logits[frame] > 0 && isLocalMax(logits, frame)) raw.push(frame);
  }
  const merged: number[] = [];
  let i = 0;
  while (i < raw.length) {
    let mean = raw[i];
    let count = 1;
    while (i + 1 < raw.length && raw[i + 1] - mean <= PEAK_MERGE_FRAMES) {
      i++;
      count++;
      mean += (raw[i] - mean) / count;
    }
    merged.push(mean);
    i++;
  }
  return merged;
}

function nearestTime(times: readonly number[], time: number): number {
  let best = times[0];
  for (const candidate of times) if (Math.abs(candidate - time) < Math.abs(best - time)) best = candidate;
  return best;
}

function beatsFromLogits(beatLogits: Float32Array, downbeatLogits: Float32Array): DetectedBeats {
  const beats = peakFrames(beatLogits).map((frame) => frame / BEAT_FPS);
  const rawDownbeats = peakFrames(downbeatLogits).map((frame) => frame / BEAT_FPS);
  const snapped = beats.length > 0 ? rawDownbeats.map((time) => nearestTime(beats, time)) : rawDownbeats;
  return { beats, downbeats: [...new Set(snapped)].toSorted((a, b) => a - b) };
}

// -- Exports -------------------------------------------------------------------

export { beatsFromLogits, peakFrames };
