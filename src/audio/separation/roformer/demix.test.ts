import { addChunk, chunkAt, demixPlan, demixSum, finishDemix, padSong } from "@/audio/separation/roformer/demix";
import { RF_CHUNK } from "@/audio/separation/roformer/spec";
import { describe, expect, it } from "vitest";

// A model that returns its input: stitching must give back the song.
function identityDemix(song: Float32Array[]): Float32Array[] {
  const plan = demixPlan(song[0].length);
  const padded = padSong(song, plan.pad);
  const acc = demixSum(padded[0].length, song.length);
  plan.starts.forEach((start, k) => {
    const chunk = chunkAt(padded, start);
    addChunk(acc, chunk.channels, start, chunk.length, plan.windows[k]);
  });
  return finishDemix(acc, plan.pad, song[0].length);
}

describe("RoFormer demix", () => {
  it("stitches overlapping chunks back into the song", () => {
    const frames = Math.round(RF_CHUNK * 5.3);
    const song = [0, 1].map((c) => Float32Array.from({ length: frames }, (_, i) => Math.sin(i * (0.01 + c * 0.003))));
    const out = identityDemix(song);
    let maxErr = 0;
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < frames; i++) maxErr = Math.max(maxErr, Math.abs(out[c][i] - song[c][i]));
    expect(maxErr).toBeLessThan(1e-5);
  });

  it("keeps MSST's per-batch fades: the first batch fades in, the last batch never fades out", () => {
    const plan = demixPlan(RF_CHUNK * 5);
    expect(plan.pad).toBe(RF_CHUNK / 2);
    expect(plan.starts).toHaveLength(12);
    expect(plan.windows[0][0]).toBe(0);
    expect(plan.windows[3][RF_CHUNK - 1]).toBe(0);
    for (const window of plan.windows.slice(8)) expect(window[RF_CHUNK - 1]).toBe(1);
  });
});
