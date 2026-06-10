import { TARGET_SAMPLE_RATE } from "@/audio/separation/audio-codec";
import { iterateChunks } from "@/audio/separation/chunker";

// -- Types --------------------------------------------------------------------

interface LagResult {
  lagSamples: number;
  lagMs: number;
  peakCorrelation: number;
  windowStart: number;
  windowLength: number;
}

interface PerChunkLag {
  chunkIndex: number;
  start: number;
  end: number;
  lag: LagResult | null;
}

// -- Constants ----------------------------------------------------------------

const DEFAULT_SEARCH_RADIUS = 4096;
const DEFAULT_WINDOW_LENGTH = 8192;
const MIN_RMS_FOR_LAG = 1e-4;
const DEFAULT_SILENCE_THRESHOLD = 1e-4;
const MAX_LEADING_SILENCE_SCAN = 8192;

function detectLeadingSilence(
  channels: Float32Array[],
  threshold: number = DEFAULT_SILENCE_THRESHOLD,
  maxScan: number = MAX_LEADING_SILENCE_SCAN,
): number {
  if (channels.length === 0) return 0;
  const limit = Math.min(channels[0]?.length ?? 0, maxScan);
  for (let i = 0; i < limit; i++) {
    for (let c = 0; c < channels.length; c++) {
      if (Math.abs(channels[c]?.[i] ?? 0) > threshold) return i;
    }
  }
  return limit;
}

// -- Helpers ------------------------------------------------------------------

function downmixToMono(channels: Float32Array[]): Float32Array {
  const length = channels[0]?.length ?? 0;
  const out = new Float32Array(length);
  const numChannels = channels.length;
  if (numChannels === 0) return out;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < numChannels; c++) sum += channels[c][i] ?? 0;
    out[i] = sum / numChannels;
  }
  return out;
}

function computeRms(samples: Float32Array, start: number, length: number): number {
  let sum = 0;
  const end = Math.min(samples.length, start + length);
  const count = end - start;
  if (count <= 0) return 0;
  for (let i = start; i < end; i++) {
    const v = samples[i];
    sum += v * v;
  }
  return Math.sqrt(sum / count);
}

function findEnergeticWindow(mono: Float32Array, windowLength: number, searchRadius: number): number {
  const safeStart = searchRadius;
  const safeEnd = Math.max(safeStart, mono.length - windowLength - searchRadius);
  if (safeEnd <= safeStart) return safeStart;
  const step = Math.max(1, Math.floor(windowLength / 4));
  let bestStart = safeStart;
  let bestRms = -1;
  for (let s = safeStart; s < safeEnd; s += step) {
    const rms = computeRms(mono, s, windowLength);
    if (rms > bestRms) {
      bestRms = rms;
      bestStart = s;
    }
    if (bestRms > 0.1) break;
  }
  return bestStart;
}

function crossCorrelateLag(
  reference: Float32Array,
  target: Float32Array,
  windowStart: number,
  windowLength: number,
  searchRadius: number,
): LagResult | null {
  if (reference.length === 0 || target.length === 0) return null;

  const safeStart = Math.max(searchRadius, windowStart);
  const maxStart = Math.min(reference.length, target.length) - windowLength - searchRadius;
  if (maxStart <= safeStart) return null;
  const start = Math.min(safeStart, maxStart);
  const length = windowLength;

  const refRms = computeRms(reference, start, length);
  const tgtRms = computeRms(target, start, length);
  if (refRms < MIN_RMS_FOR_LAG || tgtRms < MIN_RMS_FOR_LAG) return null;

  let bestLag = 0;
  let bestCorr = Number.NEGATIVE_INFINITY;
  for (let lag = -searchRadius; lag <= searchRadius; lag++) {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      const refSample = reference[start + i];
      const tgtSample = target[start + i + lag];
      sum += refSample * tgtSample;
    }
    if (sum > bestCorr) {
      bestCorr = sum;
      bestLag = lag;
    }
  }

  const normalizer = refRms * tgtRms * length;
  const normalizedPeak = normalizer > 0 ? bestCorr / normalizer : 0;
  const reportedLag = bestLag === 0 ? 0 : -bestLag;

  return {
    lagSamples: reportedLag,
    lagMs: (reportedLag / TARGET_SAMPLE_RATE) * 1000,
    peakCorrelation: normalizedPeak,
    windowStart: start,
    windowLength: length,
  };
}

function computeOverallLag(
  reference: Float32Array[],
  target: Float32Array[],
  options: { windowLength?: number; searchRadius?: number } = {},
): LagResult | null {
  const windowLength = options.windowLength ?? DEFAULT_WINDOW_LENGTH;
  const searchRadius = options.searchRadius ?? DEFAULT_SEARCH_RADIUS;
  const refMono = downmixToMono(reference);
  const tgtMono = downmixToMono(target);
  const windowStart = findEnergeticWindow(refMono, windowLength, searchRadius);
  return crossCorrelateLag(refMono, tgtMono, windowStart, windowLength, searchRadius);
}

function computePerChunkLag(
  reference: Float32Array[],
  target: Float32Array[],
  options: { windowLength?: number; searchRadius?: number } = {},
): PerChunkLag[] {
  const windowLength = options.windowLength ?? DEFAULT_WINDOW_LENGTH;
  const searchRadius = options.searchRadius ?? DEFAULT_SEARCH_RADIUS;
  const refMono = downmixToMono(reference);
  const tgtMono = downmixToMono(target);

  const results: PerChunkLag[] = [];
  let index = 0;
  for (const chunk of iterateChunks(reference)) {
    const span = chunk.end - chunk.start;
    if (span <= windowLength + searchRadius * 2) {
      results.push({ chunkIndex: index, start: chunk.start, end: chunk.end, lag: null });
      index++;
      continue;
    }
    const innerStart = chunk.start + searchRadius;
    const innerEnd = chunk.end - windowLength - searchRadius;
    let bestLocal = innerStart;
    let bestRms = -1;
    const step = Math.max(1, Math.floor(windowLength / 4));
    for (let s = innerStart; s < innerEnd; s += step) {
      const rms = computeRms(refMono, s, windowLength);
      if (rms > bestRms) {
        bestRms = rms;
        bestLocal = s;
      }
      if (bestRms > 0.1) break;
    }
    const lag = crossCorrelateLag(refMono, tgtMono, bestLocal, windowLength, searchRadius);
    results.push({ chunkIndex: index, start: chunk.start, end: chunk.end, lag });
    index++;
  }
  return results;
}

function drawOverlaidWaveforms(
  canvas: HTMLCanvasElement,
  layers: { label: string; color: string; samples: Float32Array }[],
  sampleRate: number,
  durationSec: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  const totalSamples = Math.min(Math.floor(durationSec * sampleRate), layers[0]?.samples.length ?? 0);
  if (totalSamples === 0) return;
  const samplesPerPixel = Math.max(1, Math.floor(totalSamples / width));

  for (const layer of layers) {
    ctx.strokeStyle = layer.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const sliceStart = x * samplesPerPixel;
      const sliceEnd = Math.min(layer.samples.length, sliceStart + samplesPerPixel);
      let max = Number.NEGATIVE_INFINITY;
      let min = Number.POSITIVE_INFINITY;
      for (let i = sliceStart; i < sliceEnd; i++) {
        const v = layer.samples[i];
        if (v > max) max = v;
        if (v < min) min = v;
      }
      if (!Number.isFinite(max) || !Number.isFinite(min)) continue;
      const yMax = ((1 - max) / 2) * height;
      const yMin = ((1 - min) / 2) * height;
      if (x === 0) ctx.moveTo(x, (yMax + yMin) / 2);
      ctx.lineTo(x, yMax);
      ctx.lineTo(x, yMin);
    }
    ctx.stroke();
  }
}

export {
  DEFAULT_SEARCH_RADIUS,
  DEFAULT_SILENCE_THRESHOLD,
  DEFAULT_WINDOW_LENGTH,
  computeOverallLag,
  computePerChunkLag,
  crossCorrelateLag,
  detectLeadingSilence,
  downmixToMono,
  drawOverlaidWaveforms,
  findEnergeticWindow,
};
export type { LagResult, PerChunkLag };
