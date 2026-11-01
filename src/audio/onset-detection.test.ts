import { HOP_LENGTH, N_FFT, stft } from "@/audio/separation/stft";
/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { detectVocalOnsets, mixToMono } from "./onset-detection";

const SAMPLE_RATE = 44_100;

function addBurst(signal: Float32Array, startSeconds: number, durationSeconds: number, frequency = 1200) {
  const start = Math.floor(startSeconds * SAMPLE_RATE);
  const length = Math.floor(durationSeconds * SAMPLE_RATE);
  for (let i = 0; i < length; i++) {
    const envelope = Math.min(1, i / 64) * Math.min(1, (length - i) / 256);
    signal[start + i] += 0.35 * envelope * Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE);
  }
}

describe("detectVocalOnsets", () => {
  it("returns no onset points for silence", () => {
    const onsets = detectVocalOnsets(new Float32Array(SAMPLE_RATE), { sampleRate: SAMPLE_RATE });
    expect(onsets).toEqual([]);
  });

  it("detects abrupt vocal-like events", () => {
    const signal = new Float32Array(SAMPLE_RATE * 2);
    addBurst(signal, 0.5, 0.12);
    addBurst(signal, 1.2, 0.12, 1800);

    const onsets = detectVocalOnsets(signal, { sampleRate: SAMPLE_RATE });

    expect(onsets.some((t) => Math.abs(t - 0.5) < 0.08)).toBe(true);
    expect(onsets.some((t) => Math.abs(t - 1.2) < 0.08)).toBe(true);
  });
});

describe("mixToMono", () => {
  it("averages channels sample-by-sample", () => {
    const mono = mixToMono([new Float32Array([1, 0, -1]), new Float32Array([0, 1, -1])]);
    expect(Array.from(mono)).toEqual([0.5, 0.5, -1]);
  });
});

function fullSpectrogramOnsets(mono: Float32Array, sampleRate: number): number[] {
  const spec = stft(mono);
  const novelty = new Float32Array(spec.numFrames);
  const rms = new Float32Array(spec.numFrames);
  const minBin = Math.max(1, Math.floor((180 * N_FFT) / sampleRate));
  const maxBin = Math.min(spec.numBins - 1, Math.ceil((8000 * N_FFT) / sampleRate));
  const usedBinCount = Math.max(1, maxBin - minBin + 1);
  const prevMag = new Float32Array(spec.numBins);
  let maxNovelty = 0;
  for (let frame = 0; frame < spec.numFrames; frame++) {
    let flux = 0;
    for (let bin = minBin; bin <= maxBin; bin++) {
      const idx = frame * spec.numBins + bin;
      const mag = Math.log1p(1000 * Math.hypot(spec.real[idx], spec.imag[idx]));
      const diff = mag - prevMag[bin];
      if (diff > 0) flux += diff;
      prevMag[bin] = mag;
    }
    const start = Math.max(0, frame * HOP_LENGTH - N_FFT / 2);
    const end = Math.min(mono.length, start + N_FFT);
    let energy = 0;
    for (let i = start; i < end; i++) energy += mono[i] * mono[i];
    rms[frame] = end > start ? Math.sqrt(energy / (end - start)) : 0;
    novelty[frame] = flux / usedBinCount;
    maxNovelty = Math.max(maxNovelty, novelty[frame]);
  }
  if (maxNovelty > 0) for (let i = 0; i < novelty.length; i++) novelty[i] /= maxNovelty;

  const minSpacingFrames = Math.max(1, Math.round((0.08 * sampleRate) / HOP_LENGTH));
  const candidates: Array<{ frame: number; score: number }> = [];
  for (let i = 1; i < novelty.length - 1; i++) {
    if (rms[i] < 0.004) continue;
    if (novelty[i] <= novelty[i - 1] || novelty[i] < novelty[i + 1]) continue;
    const window = Array.from(novelty.subarray(Math.max(0, i - 8), Math.min(novelty.length, i + 9))).sort(
      (a, b) => a - b,
    );
    if (novelty[i] >= window[Math.floor(window.length / 2)] + 0.08) candidates.push({ frame: i, score: novelty[i] });
  }
  const selected: Array<{ frame: number; score: number }> = [];
  for (const candidate of candidates) {
    const previous = selected[selected.length - 1];
    if (!previous || candidate.frame - previous.frame >= minSpacingFrames) selected.push(candidate);
    else if (candidate.score > previous.score) selected[selected.length - 1] = candidate;
  }
  return selected.map((candidate) => (candidate.frame * HOP_LENGTH) / sampleRate);
}

function syntheticVocalTake(seconds: number): Float32Array {
  const signal = new Float32Array(Math.floor(seconds * SAMPLE_RATE));
  let state = 12345;
  for (let i = 0; i < signal.length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    signal[i] = ((state / 0x100000000) * 2 - 1) * 0.002;
  }
  for (let t = 0.3, n = 0; t < seconds - 0.4; t += 0.23 + (n % 5) * 0.07, n++) {
    addBurst(signal, t, 0.09 + (n % 3) * 0.04, 300 + ((n * 211) % 2400));
  }
  return signal;
}

describe("equivalence with the full spectrogram algorithm", () => {
  it("finds exactly the same onsets on a deterministic multi-onset take", () => {
    const signal = syntheticVocalTake(12);
    const expected = fullSpectrogramOnsets(signal, SAMPLE_RATE);
    expect(expected.length).toBeGreaterThan(20);
    expect(detectVocalOnsets(signal, { sampleRate: SAMPLE_RATE })).toEqual(expected);
  });

  it("finds exactly the same onsets at a 48 kHz rate", () => {
    const signal = syntheticVocalTake(4);
    expect(detectVocalOnsets(signal, { sampleRate: 48_000 })).toEqual(fullSpectrogramOnsets(signal, 48_000));
  });

  describe("edge cases", () => {
    it("matches on a signal shorter than one FFT window", () => {
      const signal = syntheticVocalTake(0.05);
      expect(detectVocalOnsets(signal, { sampleRate: SAMPLE_RATE })).toEqual(
        fullSpectrogramOnsets(signal, SAMPLE_RATE),
      );
    });
  });
});
