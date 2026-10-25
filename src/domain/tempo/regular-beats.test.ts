import { describe, expect, it } from "vitest";
import { detectedGrid } from "@/domain/tempo/beat-grid";
import { regularBeats } from "@/domain/tempo/regular-beats";
import detections from "@/domain/tempo/test-fixtures/detected-beats.json";

function intervals(beats: readonly number[]): number[] {
  return beats.slice(1).map((time, i) => time - beats[i]);
}

function median(values: readonly number[]): number {
  return values.toSorted((a, b) => a - b)[values.length >> 1];
}

function barLengths(beats: number[], downbeats: number[]): number[] {
  const { downbeatIndices } = detectedGrid({ beats, downbeats });
  return downbeatIndices.slice(1).map((index, i) => index - downbeatIndices[i]);
}

describe("regularBeats", () => {
  it("lays a steady song on one even tempo that stays on the detected beats", () => {
    const { beats, downbeats } = regularBeats(detections.steady);
    expect(beats).toHaveLength(detections.steady.beats.length);
    const step = median(intervals(beats));
    for (const interval of intervals(beats)) expect(Math.abs(interval - step)).toBeLessThanOrEqual(0.0011);
    beats.forEach((time, i) => expect(Math.abs(time - detections.steady.beats[i])).toBeLessThan(0.04));
    expect(downbeats).toHaveLength(detections.steady.downbeats.length);
  });

  it("follows the beats of a song whose tempo drifts", () => {
    const beats = [0];
    for (let i = 1; i < 81; i++) beats.push(Math.round((beats[i - 1] + 60 / (78 + (6 * i) / 80)) * 1000) / 1000);
    const downbeats = beats.filter((_, i) => i % 4 === 0);
    const result = regularBeats({ beats, downbeats });
    expect(result.beats).toHaveLength(beats.length);
    result.beats.forEach((time, i) => expect(Math.abs(time - beats[i])).toBeLessThanOrEqual(0.035));
    expect(result.downbeats).toHaveLength(downbeats.length);
  });

  it("drops off-beats and fills missed beats so every beat is one tempo step apart", () => {
    const { beats } = regularBeats(detections.syncopated);
    const step = median(intervals(beats));
    for (const interval of intervals(beats)) {
      expect(interval).toBeGreaterThan(step * 0.8);
      expect(interval).toBeLessThan(step * 1.2);
    }
  });

  it("repairs split and shifted bars", () => {
    const { beats, downbeats } = regularBeats(detections.syncopated);
    expect(new Set(barLengths(beats, downbeats))).toEqual(new Set([4]));
  });
});

describe("edge cases", () => {
  it("passes through detections too short to read a tempo from", () => {
    expect(regularBeats({ beats: [], downbeats: [] })).toEqual({ beats: [], downbeats: [] });
    expect(regularBeats({ beats: [1], downbeats: [1] })).toEqual({ beats: [1], downbeats: [1] });
    expect(regularBeats({ beats: [1, 1.5], downbeats: [1] })).toEqual({ beats: [1, 1.5], downbeats: [1] });
  });

  it("keeps a real meter change", () => {
    const beats = Array.from({ length: 24 }, (_, i) => i * 0.5);
    const downbeats = [0, 2, 4, 5.5, 7, 8.5, 10];
    expect(regularBeats({ beats, downbeats })).toEqual({ beats, downbeats });
  });
});
