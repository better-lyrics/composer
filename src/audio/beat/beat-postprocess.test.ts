import { describe, expect, it } from "vitest";
import { BEAT_CHUNK_BORDER, chunkInput, chunkStarts, mergeChunkLogits } from "@/audio/beat/beat-chunks";
import { beatsFromLogits, peakFrames } from "@/audio/beat/beat-peaks";
import peaksReference from "@/audio/beat/test-fixtures/peaks-reference.json";

describe("chunkStarts", () => {
  it("matches upstream split_piece for every length", () => {
    for (const [frames, starts] of Object.entries(peaksReference.chunkStarts)) {
      expect(chunkStarts(Number(frames)), `${frames} frames`).toEqual(starts);
    }
  });
});

describe("chunkInput", () => {
  it("zero pads the first chunk by the border", () => {
    const mel = Float32Array.from({ length: 20 * 128 }, (_, i) => i + 1);
    const chunk = chunkInput(mel, 20, -BEAT_CHUNK_BORDER);
    expect(chunk.frames).toBe(20 + 2 * BEAT_CHUNK_BORDER);
    expect(chunk.input.subarray(0, BEAT_CHUNK_BORDER * 128).every((v) => v === 0)).toBe(true);
    expect(chunk.input[BEAT_CHUNK_BORDER * 128]).toBe(1);
  });
});

describe("mergeChunkLogits", () => {
  it("keeps the earlier chunk where chunks overlap and fills gaps with -1000", () => {
    const chunk = (value: number, frames: number) => ({
      beat: new Float32Array(frames).fill(value),
      downbeat: new Float32Array(frames).fill(value),
    });
    const merged = mergeChunkLogits([chunk(1, 30), chunk(2, 30)], [0, 10], 50);
    expect(merged.beat[BEAT_CHUNK_BORDER]).toBe(1);
    expect(merged.beat[23]).toBe(1);
    expect(merged.beat[24]).toBe(2);
    expect(merged.beat[33]).toBe(2);
    expect(merged.beat[34]).toBe(-1000);
    expect(merged.beat[0]).toBe(-1000);
  });
});

describe("beatsFromLogits", () => {
  it("matches the upstream minimal postprocessor", () => {
    const result = beatsFromLogits(
      Float32Array.from(peaksReference.beatLogits),
      Float32Array.from(peaksReference.downbeatLogits),
    );
    expect(result.beats).toEqual(peaksReference.beats);
    expect(result.downbeats).toEqual(peaksReference.downbeats);
  });

  it("finds nothing when every logit is negative", () => {
    expect(beatsFromLogits(new Float32Array(100).fill(-3), new Float32Array(100).fill(-3))).toEqual({
      beats: [],
      downbeats: [],
    });
  });

  it("merges a plateau of adjacent maxima into its mean frame", () => {
    const logits = new Float32Array(20).fill(-5);
    logits[10] = 2;
    logits[11] = 2;
    expect(peakFrames(logits)).toEqual([10.5]);
  });

  it("snaps downbeats to the nearest beat and removes duplicates", () => {
    const beat = new Float32Array(200).fill(-5);
    const downbeat = new Float32Array(200).fill(-5);
    beat[50] = 3;
    beat[100] = 3;
    downbeat[52] = 3;
    downbeat[60] = 3;
    expect(beatsFromLogits(beat, downbeat).downbeats).toEqual([1]);
  });
});
