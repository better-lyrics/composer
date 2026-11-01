import { stftFrameCount } from "@/audio/separation/stft";
import { analyseChunk } from "@/audio/spectrum/analyse-chunk";
import { CHUNK_FRAMES } from "@/domain/spectrum/chunk-order";
import { describe, expect, it } from "vitest";

const SAMPLE_RATE = 44100;
const FFT_SIZE = 1024;
const HOP = 256;
const BINS = FFT_SIZE / 2 + 1;

function sine(hz: number, seconds: number): Float32Array {
  return Float32Array.from({ length: Math.floor(seconds * SAMPLE_RATE) }, (_, i) =>
    Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE),
  );
}

function noise(length: number): Float32Array {
  let state = 12345;
  return Float32Array.from({ length }, () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 1073741824 - 1;
  });
}

function median(values: Uint8Array): number {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
}

describe("analyseChunk", () => {
  it("puts a 1 kHz sine's peak in the 1 kHz bin in every frame", () => {
    const { magnitude, frameCount } = analyseChunk(sine(1000, 3), FFT_SIZE, HOP, 1, false);
    expect(frameCount).toBe(CHUNK_FRAMES);
    const expectedBin = Math.round((1000 * FFT_SIZE) / SAMPLE_RATE);
    for (let frame = 0; frame < frameCount; frame++) {
      const row = magnitude.subarray(frame * BINS, (frame + 1) * BINS);
      expect(row.indexOf(Math.max(...row))).toBe(expectedBin);
    }
  });

  it("shows a steady tone as calm phase and noise as busy phase", () => {
    const toneBin = Math.round((1000 * FFT_SIZE) / SAMPLE_RATE);
    const tone = analyseChunk(sine(1000, 2), FFT_SIZE, HOP, 1, false);
    const toneChanges = Uint8Array.from({ length: tone.frameCount }, (_, f) => tone.phaseChange[f * BINS + toneBin]);
    expect(median(toneChanges)).toBeLessThan(32);
    const hiss = analyseChunk(noise(2 * SAMPLE_RATE), FFT_SIZE, HOP, 1, false);
    expect(median(hiss.phaseChange)).toBeGreaterThan(64);
  });

  describe("edge cases", () => {
    it("sizes a last chunk that does not fill 256 frames", () => {
      const signal = sine(440, 2);
      const total = stftFrameCount(signal.length, true, { fftSize: FFT_SIZE, hop: HOP });
      const lastChunk = Math.floor(total / CHUNK_FRAMES);
      const result = analyseChunk(signal, FFT_SIZE, HOP, lastChunk, true);
      expect(result.frameCount).toBe(total - lastChunk * CHUNK_FRAMES);
      expect(result.magnitude).toHaveLength(result.frameCount * BINS);
      expect(result.rawPhase).toHaveLength(result.frameCount * BINS);
    });
  });
});
