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
