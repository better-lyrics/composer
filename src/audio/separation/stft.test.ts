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

describe("configurable frames", () => {
  it("counts frames for a custom size and hop", () => {
    expect(stftFrameCount(44100, true, { fftSize: 2048, hop: 512 })).toBe(1 + Math.floor(44100 / 512));
  });

  it("visits only the requested frame range", () => {
    const visited: number[] = [];
    forEachStftFrame(new Float32Array(44100), (frame) => visited.push(frame), true, {
      fftSize: 1024,
      hop: 256,
      firstFrame: 10,
      frameCount: 3,
    });
    expect(visited).toEqual([10, 11, 12]);
  });

  it("finds a 1 kHz sine in the right bin at 2048", () => {
    const sampleRate = 44100;
    const signal = Float32Array.from({ length: 8192 }, (_, i) => Math.sin((2 * Math.PI * 1000 * i) / sampleRate));
    let peakBin = -1;
    forEachStftFrame(
      signal,
      (frame, real, imag) => {
        if (frame !== 4) return;
        let best = 0;
        for (let bin = 0; bin <= 1024; bin++) {
          const magnitude = Math.hypot(real[bin], imag[bin]);
          if (magnitude > best) {
            best = magnitude;
            peakBin = bin;
          }
        }
      },
      true,
      { fftSize: 2048, hop: 512 },
    );
    expect(peakBin).toBe(Math.round((1000 * 2048) / sampleRate));
  });

  it("gives a frame range the same coefficients as a full pass, edges included", () => {
    const signal = Float32Array.from({ length: 6000 }, (_, i) => Math.sin(i * 0.37) + 0.3 * Math.cos(i * 1.91));
    const framing = { fftSize: 1024, hop: 256 };
    const full = new Map<number, Float32Array>();
    forEachStftFrame(signal, (frame, real) => full.set(frame, real.slice()), true, framing);
    const last = full.size - 1;
    for (const firstFrame of [0, 5, last - 1]) {
      forEachStftFrame(
        signal,
        (frame, real) => expect(Array.from(real)).toEqual(Array.from(full.get(frame) ?? [])),
        true,
        { ...framing, firstFrame, frameCount: 2 },
      );
    }
  });
});
