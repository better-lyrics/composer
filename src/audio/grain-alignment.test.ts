import { describe, expect, it } from "vitest";
import { alignedGrainOffset } from "@/audio/grain-alignment";

const SAMPLE_RATE = 44100;

function sine(hz: number, seconds: number): Float32Array {
  return Float32Array.from({ length: seconds * SAMPLE_RATE }, (_, i) => Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE));
}

function noise(seconds: number): Float32Array {
  let seed = 7;
  return Float32Array.from({ length: seconds * SAMPLE_RATE }, () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 1073741824 - 1;
  });
}

describe("alignedGrainOffset", () => {
  it("starts the next grain in phase with the previous one", () => {
    const samples = sine(441, 1);
    const offset = alignedGrainOffset(samples, SAMPLE_RATE, 0.1, 0.2 + 37 / SAMPLE_RATE, 0.015, 0.04);
    const shift = Math.round((offset - 0.1) * SAMPLE_RATE);
    expect(shift % 100).toBe(0);
    expect(Math.abs(offset - 0.2)).toBeLessThanOrEqual(0.015);
  });

  it("continues seamlessly when the continuation is in reach", () => {
    const samples = noise(1);
    expect(alignedGrainOffset(samples, SAMPLE_RATE, 0.3, 0.31, 0.015, 0.04)).toBeCloseTo(0.3, 6);
  });

  describe("edge cases", () => {
    it("falls back to the target when the reference runs past the audio", () => {
      expect(alignedGrainOffset(sine(441, 1), SAMPLE_RATE, 0.99, 0.5, 0.015, 0.04)).toBe(0.5);
    });

    it("stays inside the audio near the start", () => {
      expect(alignedGrainOffset(noise(1), SAMPLE_RATE, 0.5, 0, 0.015, 0.04)).toBeGreaterThanOrEqual(0);
    });
  });
});
