import { HOP_LENGTH, N_FFT, forEachStftFrame, istft, stft, stftFrameCount } from "@/audio/separation/stft";
import { describe, expect, it } from "vitest";

function rms(a: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
  return Math.sqrt(sum / a.length);
}

function diffRms(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum / n);
}

describe("stft", () => {
  it("round-trips a sine wave with low RMS error", () => {
    const sr = 44100;
    const length = 32768;
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i++) signal[i] = Math.sin((2 * Math.PI * 440 * i) / sr) * 0.5;

    const spec = stft(signal);
    const reconstructed = istft(spec, length);
    expect(reconstructed.length).toBe(length);

    const pad = 8192;
    const a = signal.subarray(pad, length - pad);
    const b = reconstructed.subarray(pad, length - pad);
    const err = diffRms(a, b);
    const ref = rms(a);
    expect(err / ref).toBeLessThan(0.05);
  });

  it("round-trips a normalized spectrogram without losing amplitude", () => {
    const sr = 44100;
    const length = 32768;
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i++) signal[i] = Math.sin((2 * Math.PI * 880 * i) / sr) * 0.25;

    const spec = stft(signal, { normalized: true });
    const reconstructed = istft(spec, length, { normalized: true });

    const pad = 8192;
    const a = signal.subarray(pad, length - pad);
    const b = reconstructed.subarray(pad, length - pad);
    const err = diffRms(a, b);
    const ref = rms(a);
    expect(err / ref).toBeLessThan(0.05);
    expect(rms(b) / ref).toBeGreaterThan(0.95);
  });
});

function seededNoise(length: number, seed: number): Float32Array {
  const out = new Float32Array(length);
  let state = seed;
  for (let i = 0; i < length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    out[i] = (state / 0x100000000) * 2 - 1;
  }
  return out;
}

describe("forEachStftFrame", () => {
  it("yields every frame of stft one at a time with identical coefficients", () => {
    const signal = seededNoise(N_FFT * 3 + 517, 7);
    const spec = stft(signal);
    let seen = 0;
    forEachStftFrame(signal, (frame, real, imag) => {
      expect(frame).toBe(seen);
      for (let bin = 0; bin < spec.numBins; bin++) {
        expect(real[bin]).toBe(spec.real[frame * spec.numBins + bin]);
        expect(imag[bin]).toBe(spec.imag[frame * spec.numBins + bin]);
      }
      seen++;
    });
    expect(seen).toBe(spec.numFrames);
  });

  it("reuses one frame buffer instead of allocating per frame", () => {
    const buffers = new Set<Float32Array>();
    forEachStftFrame(seededNoise(N_FFT * 2, 3), (_frame, real) => buffers.add(real));
    expect(buffers.size).toBe(1);
  });

  describe("edge cases", () => {
    it("counts frames the same way stft does", () => {
      for (const length of [1, HOP_LENGTH, N_FFT, N_FFT + 1, N_FFT * 4 + 3]) {
        expect(stftFrameCount(length)).toBe(stft(seededNoise(length, length)).numFrames);
      }
    });
  });
});
