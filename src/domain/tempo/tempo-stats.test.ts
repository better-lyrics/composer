import { describe, expect, it } from "vitest";
import { detectedGrid } from "@/domain/tempo/beat-grid";
import { tempoStats } from "@/domain/tempo/tempo-stats";

function evenBeats(bpm: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => (60 / bpm) * i);
}

function everyFourth(beats: number[]): number[] {
  return beats.filter((_, i) => i % 4 === 0);
}

describe("tempoStats", () => {
  it("reads a steady tempo", () => {
    const beats = evenBeats(120, 33);
    const stats = tempoStats(detectedGrid({ beats, downbeats: everyFourth(beats) }));
    expect(stats?.bpm).toBeCloseTo(120);
    expect(stats?.bars).toBe(9);
    expect(stats?.steady).toBe(true);
  });

  it("reports the range of a tempo that drifts", () => {
    const beats = [0];
    for (let i = 1; i < 81; i++) beats.push(beats[i - 1] + 60 / (78 + (6 * i) / 80));
    const stats = tempoStats(detectedGrid({ beats, downbeats: everyFourth(beats) }));
    expect(stats?.steady).toBe(false);
    expect(stats?.low).toBeGreaterThan(78);
    expect(stats?.high).toBeLessThan(84.5);
    expect(stats?.low).toBeLessThan(stats?.high ?? 0);
  });

  it("reads the tempo from whole bars when beats swing long and short", () => {
    const beats = Array.from({ length: 33 }, (_, i) => Math.floor(i / 2) * 0.5 + (i % 2) * 0.3);
    const stats = tempoStats(detectedGrid({ beats, downbeats: everyFourth(beats) }));
    expect(stats?.bpm).toBeCloseTo(240);
    expect(stats?.bpm).toBeGreaterThanOrEqual(stats?.low ?? 0);
    expect(stats?.bpm).toBeLessThanOrEqual(stats?.high ?? 0);
  });

  it("ignores the offset", () => {
    const grid = detectedGrid({ beats: evenBeats(90, 9), downbeats: [0] });
    expect(tempoStats({ ...grid, offsetMs: 150 })?.bpm).toBeCloseTo(90);
  });

  it("falls back to the median tempo when there is no full bar", () => {
    const stats = tempoStats(detectedGrid({ beats: evenBeats(100, 5), downbeats: [0] }));
    expect(stats?.low).toBeCloseTo(100);
    expect(stats?.high).toBeCloseTo(100);
    expect(stats?.steady).toBe(true);
  });

  it("is null for fewer than two beats", () => {
    expect(tempoStats(detectedGrid({ beats: [1], downbeats: [] }))).toBeNull();
  });
});
