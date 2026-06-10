import { describe, expect, it } from "vitest";
import { iterateChunks, chunkCount, stitchChunks, SEGMENT_SAMPLES, STRIDE_SAMPLES } from "@/audio/separation/chunker";

interface ArgmaxResult {
  index: number;
  value: number;
}

function argmaxAbs(arr: Float32Array): ArgmaxResult {
  let index = 0;
  let value = 0;
  for (let i = 0; i < arr.length; i++) {
    const abs = Math.abs(arr[i]);
    if (abs > value) {
      value = abs;
      index = i;
    }
  }
  return { index, value };
}

function makeStereoImpulse(totalFrames: number, position: number): Float32Array[] {
  const left = new Float32Array(totalFrames);
  const right = new Float32Array(totalFrames);
  left[position] = 1;
  right[position] = 1;
  return [left, right];
}

function roundtrip(channels: Float32Array[], totalFrames: number): Float32Array[] {
  const chunks = Array.from(iterateChunks(channels));
  return stitchChunks(chunks, totalFrames, channels.length);
}

const TOTAL_FRAMES = SEGMENT_SAMPLES * 2 + 50_000;

describe("impulse alignment through chunker-stitcher roundtrip", () => {
  it("preserves impulse at mid-first-chunk", () => {
    const position = Math.floor(SEGMENT_SAMPLES / 2);
    const channels = makeStereoImpulse(TOTAL_FRAMES, position);
    const stitched = roundtrip(channels, TOTAL_FRAMES);
    for (const channel of stitched) {
      const peak = argmaxAbs(channel);
      expect(Math.abs(peak.index - position)).toBeLessThanOrEqual(1);
      expect(peak.value).toBeGreaterThanOrEqual(0.99);
    }
  });

  it("preserves impulse in first overlap region", () => {
    const position = STRIDE_SAMPLES + 1000;
    const channels = makeStereoImpulse(TOTAL_FRAMES, position);
    const stitched = roundtrip(channels, TOTAL_FRAMES);
    for (const channel of stitched) {
      const peak = argmaxAbs(channel);
      expect(Math.abs(peak.index - position)).toBeLessThanOrEqual(1);
      expect(peak.value).toBeGreaterThanOrEqual(0.99);
    }
  });

  it("preserves impulse at mid-second-chunk", () => {
    const position = STRIDE_SAMPLES + Math.floor(SEGMENT_SAMPLES / 2);
    const channels = makeStereoImpulse(TOTAL_FRAMES, position);
    const stitched = roundtrip(channels, TOTAL_FRAMES);
    for (const channel of stitched) {
      const peak = argmaxAbs(channel);
      expect(Math.abs(peak.index - position)).toBeLessThanOrEqual(1);
      expect(peak.value).toBeGreaterThanOrEqual(0.99);
    }
  });

  it("preserves impulse in second overlap region", () => {
    const position = 2 * STRIDE_SAMPLES + 1000;
    const channels = makeStereoImpulse(TOTAL_FRAMES, position);
    const stitched = roundtrip(channels, TOTAL_FRAMES);
    for (const channel of stitched) {
      const peak = argmaxAbs(channel);
      expect(Math.abs(peak.index - position)).toBeLessThanOrEqual(1);
      expect(peak.value).toBeGreaterThanOrEqual(0.99);
    }
  });

  it("preserves impulse near end of signal", () => {
    const position = TOTAL_FRAMES - 5000;
    const channels = makeStereoImpulse(TOTAL_FRAMES, position);
    const stitched = roundtrip(channels, TOTAL_FRAMES);
    for (const channel of stitched) {
      const peak = argmaxAbs(channel);
      expect(Math.abs(peak.index - position)).toBeLessThanOrEqual(1);
      expect(peak.value).toBeGreaterThanOrEqual(0.99);
    }
  });
});

describe("invariants", () => {
  it("test signal produces at least 3 chunks", () => {
    expect(chunkCount(TOTAL_FRAMES)).toBeGreaterThanOrEqual(3);
  });

  it("silence in produces silence out", () => {
    const channels = [new Float32Array(TOTAL_FRAMES), new Float32Array(TOTAL_FRAMES)];
    const stitched = roundtrip(channels, TOTAL_FRAMES);
    for (const channel of stitched) {
      const peak = argmaxAbs(channel);
      expect(peak.value).toBe(0);
    }
  });

  it("stitched length equals totalFrames for every channel", () => {
    const channels = makeStereoImpulse(TOTAL_FRAMES, Math.floor(TOTAL_FRAMES / 2));
    const stitched = roundtrip(channels, TOTAL_FRAMES);
    expect(stitched.length).toBe(2);
    for (const channel of stitched) {
      expect(channel.length).toBe(TOTAL_FRAMES);
    }
  });
});

describe("edge cases", () => {
  it("preserves impulse at sample 0", () => {
    const channels = makeStereoImpulse(TOTAL_FRAMES, 0);
    const stitched = roundtrip(channels, TOTAL_FRAMES);
    for (const channel of stitched) {
      const peak = argmaxAbs(channel);
      expect(peak.index).toBeLessThanOrEqual(1);
      expect(peak.value).toBeGreaterThanOrEqual(0.99);
    }
  });

  it("preserves impulse at very last sample", () => {
    const position = TOTAL_FRAMES - 1;
    const channels = makeStereoImpulse(TOTAL_FRAMES, position);
    const stitched = roundtrip(channels, TOTAL_FRAMES);
    for (const channel of stitched) {
      const peak = argmaxAbs(channel);
      expect(Math.abs(peak.index - position)).toBeLessThanOrEqual(1);
      expect(peak.value).toBeGreaterThanOrEqual(0.99);
    }
  });

  it("preserves impulse in single-chunk-fits signal", () => {
    const shortFrames = Math.floor(SEGMENT_SAMPLES / 2);
    const position = Math.floor(shortFrames / 2);
    const channels = makeStereoImpulse(shortFrames, position);
    const stitched = roundtrip(channels, shortFrames);
    expect(chunkCount(shortFrames)).toBe(1);
    for (const channel of stitched) {
      const peak = argmaxAbs(channel);
      expect(Math.abs(peak.index - position)).toBeLessThanOrEqual(1);
      expect(peak.value).toBeGreaterThanOrEqual(0.99);
    }
  });
});
