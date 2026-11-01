import { barNumberAt, beatInBar, beatIndexAt, beatTime, detectedGrid, isDownbeat } from "@/domain/tempo/beat-grid";
import { describe, expect, it } from "vitest";

const detection = { beats: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5], downbeats: [0.5, 2.5, 4.5] };

describe("detectedGrid", () => {
  it("maps downbeat times to beat indices and infers the bar length", () => {
    const grid = detectedGrid(detection);
    expect(grid.downbeatIndices).toEqual([0, 4, 8]);
    expect(grid.beatsPerBar).toBe(4);
    expect(grid.source).toBe("detected");
    expect(grid.offsetMs).toBe(0);
  });

  it("matches a downbeat to a beat within 30 ms only", () => {
    expect(detectedGrid({ beats: [0, 1, 2], downbeats: [1.02, 1.6] }).downbeatIndices).toEqual([1]);
  });

  it("falls back to 4 beats per bar with fewer than two downbeats", () => {
    expect(detectedGrid({ beats: [0, 1, 2], downbeats: [0] }).beatsPerBar).toBe(4);
  });

  it("keeps a copy of the detection as its origin", () => {
    const grid = detectedGrid(detection);
    expect(grid.origin).toEqual(detection);
    expect(grid.origin).not.toBe(detection);
  });
});

describe("beatTime and beatIndexAt", () => {
  const grid = { ...detectedGrid(detection), offsetMs: 100 };

  it("applies the offset", () => {
    expect(beatTime(grid, 0)).toBeCloseTo(0.6);
  });

  it("finds the last beat at or before a time", () => {
    expect(beatIndexAt(grid, 0.59)).toBe(-1);
    expect(beatIndexAt(grid, 0.6)).toBe(0);
    expect(beatIndexAt(grid, 1.3)).toBe(1);
    expect(beatIndexAt(grid, 99)).toBe(8);
  });

  it("returns -1 for an empty grid", () => {
    expect(beatIndexAt({ ...grid, beats: [], downbeatIndices: [] }, 1)).toBe(-1);
  });
});

describe("regressions", () => {
  it("regression: pickup beats before the first bar count as the end of a bar, not its downbeat", () => {
    const beats = Array.from({ length: 10 }, (_, i) => i * 0.5);
    const grid = detectedGrid({ beats, downbeats: [1, 3] });
    expect([0, 1].map((index) => beatInBar(grid, index))).toEqual([2, 3]);
    expect(beatInBar(grid, 2)).toBe(0);
  });

  it("regression: sparse downbeats fall back to four beats per bar instead of a bar no project can load", () => {
    const beats = Array.from({ length: 40 }, (_, i) => i * 0.5);
    expect(detectedGrid({ beats, downbeats: [0, 16] }).beatsPerBar).toBe(4);
  });

  it("regression: a playhead put on a beat that was rounded up by a millisecond still reads that beat", () => {
    const grid = detectedGrid({ beats: [1, 1.5, 2.001], downbeats: [1] });
    expect(beatIndexAt(grid, 2.0006)).toBe(2);
  });
});

describe("bars", () => {
  const grid = detectedGrid(detection);

  it("numbers bars from 1 at the first downbeat", () => {
    expect(barNumberAt(grid, 0)).toBe(1);
    expect(barNumberAt(grid, 3)).toBe(1);
    expect(barNumberAt(grid, 4)).toBe(2);
    expect(barNumberAt(grid, 8)).toBe(3);
  });

  it("puts pickup beats before the first downbeat in bar 0", () => {
    expect(barNumberAt({ ...grid, downbeatIndices: [2, 6] }, 1)).toBe(0);
  });

  it("knows downbeats", () => {
    expect(isDownbeat(grid, 4)).toBe(true);
    expect(isDownbeat(grid, 5)).toBe(false);
    expect(isDownbeat(grid, 0)).toBe(true);
  });
});
