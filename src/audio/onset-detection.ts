import { HOP_LENGTH, N_FFT, stft } from "@/audio/separation/stft";

interface DetectVocalOnsetsOptions {
  sampleRate: number;
  compression?: number;
  medianWindowFrames?: number;
  thresholdDelta?: number;
  minSpacingSeconds?: number;
  minRms?: number;
  minFrequency?: number;
  maxFrequency?: number;
}

const DEFAULT_COMPRESSION = 1000;
const DEFAULT_MEDIAN_WINDOW = 8;
const DEFAULT_THRESHOLD_DELTA = 0.08;
const DEFAULT_MIN_SPACING_SECONDS = 0.08;
const DEFAULT_MIN_RMS = 0.004;
const DEFAULT_MIN_FREQUENCY = 180;
const DEFAULT_MAX_FREQUENCY = 8000;

type ResolvedOnsetOptions = Required<Omit<DetectVocalOnsetsOptions, "sampleRate">>;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function frameRms(mono: Float32Array, frame: number): number {
  const center = frame * HOP_LENGTH;
  const start = Math.max(0, center - N_FFT / 2);
  const end = Math.min(mono.length, start + N_FFT);
  if (end <= start) return 0;
  let energy = 0;
  for (let i = start; i < end; i++) energy += mono[i] * mono[i];
  return Math.sqrt(energy / (end - start));
}

function spectralFlux(
  mono: Float32Array,
  sampleRate: number,
  opts: ResolvedOnsetOptions,
): {
  novelty: Float32Array;
  rms: Float32Array;
} {
  const spec = stft(mono);
  const novelty = new Float32Array(spec.numFrames);
  const rms = new Float32Array(spec.numFrames);
  const minBin = Math.max(1, Math.floor((opts.minFrequency * N_FFT) / sampleRate));
  const maxBin = Math.min(spec.numBins - 1, Math.ceil((opts.maxFrequency * N_FFT) / sampleRate));
  const usedBinCount = Math.max(1, maxBin - minBin + 1);
  const prevMag = new Float32Array(spec.numBins);
  let maxNovelty = 0;

  for (let frame = 0; frame < spec.numFrames; frame++) {
    let flux = 0;
    for (let bin = minBin; bin <= maxBin; bin++) {
      const idx = frame * spec.numBins + bin;
      const re = spec.real[idx];
      const im = spec.imag[idx];
      const mag = Math.log1p(opts.compression * Math.hypot(re, im));
      const diff = mag - prevMag[bin];
      if (diff > 0) flux += diff;
      prevMag[bin] = mag;
    }

    rms[frame] = frameRms(mono, frame);
    novelty[frame] = flux / usedBinCount;
    maxNovelty = Math.max(maxNovelty, novelty[frame]);
  }

  if (maxNovelty > 0) {
    for (let i = 0; i < novelty.length; i++) novelty[i] /= maxNovelty;
  }

  return { novelty, rms };
}

function detectVocalOnsets(mono: Float32Array, options: DetectVocalOnsetsOptions): number[] {
  const sampleRate = options.sampleRate;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || mono.length === 0) return [];

  const opts = {
    compression: options.compression ?? DEFAULT_COMPRESSION,
    medianWindowFrames: options.medianWindowFrames ?? DEFAULT_MEDIAN_WINDOW,
    thresholdDelta: options.thresholdDelta ?? DEFAULT_THRESHOLD_DELTA,
    minSpacingSeconds: options.minSpacingSeconds ?? DEFAULT_MIN_SPACING_SECONDS,
    minRms: options.minRms ?? DEFAULT_MIN_RMS,
    minFrequency: options.minFrequency ?? DEFAULT_MIN_FREQUENCY,
    maxFrequency: options.maxFrequency ?? DEFAULT_MAX_FREQUENCY,
  };

  const { novelty, rms } = spectralFlux(mono, sampleRate, opts);
  const minSpacingFrames = Math.max(1, Math.round((opts.minSpacingSeconds * sampleRate) / HOP_LENGTH));
  const candidates: Array<{ frame: number; score: number }> = [];

  for (let i = 1; i < novelty.length - 1; i++) {
    if (rms[i] < opts.minRms) continue;
    if (novelty[i] <= novelty[i - 1] || novelty[i] < novelty[i + 1]) continue;
    const start = Math.max(0, i - opts.medianWindowFrames);
    const end = Math.min(novelty.length, i + opts.medianWindowFrames + 1);
    const threshold = median(Array.from(novelty.subarray(start, end))) + opts.thresholdDelta;
    if (novelty[i] >= threshold) candidates.push({ frame: i, score: novelty[i] });
  }

  const selected: Array<{ frame: number; score: number }> = [];
  for (const candidate of candidates) {
    const previous = selected[selected.length - 1];
    if (!previous || candidate.frame - previous.frame >= minSpacingFrames) {
      selected.push(candidate);
    } else if (candidate.score > previous.score) {
      selected[selected.length - 1] = candidate;
    }
  }

  return selected.map((candidate) => (candidate.frame * HOP_LENGTH) / sampleRate);
}

function mixToMono(channels: Float32Array[]): Float32Array {
  const length = channels[0]?.length ?? 0;
  const out = new Float32Array(length);
  if (channels.length === 0) return out;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const channel of channels) sum += channel[i] ?? 0;
    out[i] = sum / channels.length;
  }
  return out;
}

export { detectVocalOnsets, mixToMono };
