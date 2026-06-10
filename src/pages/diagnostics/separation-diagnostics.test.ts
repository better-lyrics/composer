import { describe, expect, it } from "vitest";
import { TARGET_SAMPLE_RATE } from "@/audio/separation/audio-codec";
import {
  computeOverallLag,
  crossCorrelateLag,
  downmixToMono,
  findEnergeticWindow,
} from "@/pages/diagnostics/separation-diagnostics";

// -- Helpers ------------------------------------------------------------------

function makeSineWave(lengthSamples: number, freqHz: number, sampleRate: number): Float32Array {
  const out = new Float32Array(lengthSamples);
  for (let i = 0; i < lengthSamples; i++) {
    out[i] = Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return out;
}

function shiftSamples(input: Float32Array, lag: number): Float32Array {
  const out = new Float32Array(input.length);
  if (lag === 0) {
    out.set(input);
    return out;
  }
  if (lag > 0) {
    for (let i = lag; i < input.length; i++) out[i - lag] = input[i];
  } else {
    const abs = -lag;
    for (let i = 0; i < input.length - abs; i++) out[i + abs] = input[i];
  }
  return out;
}

describe("downmixToMono", () => {
  it("averages stereo channels", () => {
    const left = new Float32Array([1, 0, -1, 0]);
    const right = new Float32Array([-1, 0, 1, 0]);
    const mono = downmixToMono([left, right]);
    expect(Array.from(mono)).toEqual([0, 0, 0, 0]);
  });

  it("returns an empty array when no channels are passed", () => {
    const mono = downmixToMono([]);
    expect(mono.length).toBe(0);
  });

  it("preserves a single channel as-is", () => {
    const ch = new Float32Array([0.5, -0.5]);
    const mono = downmixToMono([ch]);
    expect(Array.from(mono)).toEqual([0.5, -0.5]);
  });
});

describe("crossCorrelateLag", () => {
  it("detects a zero-sample lag for identical signals", () => {
    const length = 8192 * 4;
    const ref = makeSineWave(length, 1000, TARGET_SAMPLE_RATE);
    const result = crossCorrelateLag(ref, ref, 4096, 8192, 256);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.lagSamples).toBe(0);
    expect(result.peakCorrelation).toBeGreaterThan(0.99);
  });

  it("detects a positive lag when target leads reference", () => {
    const length = 8192 * 4;
    const ref = makeSineWave(length, 440, TARGET_SAMPLE_RATE);
    const target = shiftSamples(ref, 32);
    const result = crossCorrelateLag(ref, target, 4096, 8192, 256);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.lagSamples).toBe(32);
  });

  it("detects a negative lag when target trails reference", () => {
    const length = 8192 * 4;
    const ref = makeSineWave(length, 440, TARGET_SAMPLE_RATE);
    const target = shiftSamples(ref, -48);
    const result = crossCorrelateLag(ref, target, 4096, 8192, 256);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.lagSamples).toBe(-48);
  });

  it("returns null when reference signal is silent", () => {
    const ref = new Float32Array(8192);
    const target = makeSineWave(8192, 440, TARGET_SAMPLE_RATE);
    const result = crossCorrelateLag(ref, target, 1000, 2048, 128);
    expect(result).toBeNull();
  });

  it("reports lagMs scaled to the project sample rate", () => {
    const length = 8192 * 4;
    const ref = makeSineWave(length, 440, TARGET_SAMPLE_RATE);
    const target = shiftSamples(ref, 441);
    const result = crossCorrelateLag(ref, target, 4096, 8192, 512);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.lagSamples).toBe(441);
    expect(result.lagMs).toBeCloseTo(10, 2);
  });
});

describe("findEnergeticWindow", () => {
  it("returns a safe start position bounded by the search radius", () => {
    const samples = new Float32Array(40000);
    for (let i = 20000; i < 30000; i++) samples[i] = Math.sin(i * 0.01);
    const start = findEnergeticWindow(samples, 4096, 1024);
    expect(start).toBeGreaterThanOrEqual(1024);
    expect(start + 4096 + 1024).toBeLessThanOrEqual(samples.length);
  });

  it("falls back to a safe start when the signal is mostly silent", () => {
    const samples = new Float32Array(40000);
    const start = findEnergeticWindow(samples, 4096, 1024);
    expect(start).toBeGreaterThanOrEqual(1024);
  });
});

describe("computeOverallLag", () => {
  it("detects an end-to-end positive shift across a stereo pair", () => {
    const length = TARGET_SAMPLE_RATE;
    const left = makeSineWave(length, 220, TARGET_SAMPLE_RATE);
    const right = makeSineWave(length, 220, TARGET_SAMPLE_RATE);
    const reference = [left, right];
    const target = [shiftSamples(left, 100), shiftSamples(right, 100)];
    const result = computeOverallLag(reference, target, { windowLength: 8192, searchRadius: 512 });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.lagSamples).toBe(100);
  });
});
