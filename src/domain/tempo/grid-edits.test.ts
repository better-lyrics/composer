import { describe, expect, it } from "vitest";
import { type BeatGrid, beatTime, detectedGrid } from "@/domain/tempo/beat-grid";
import {
  canDouble,
  canHalve,
  doubled,
  halved,
  isEdited,
  manualGrid,
  resetGrid,
  withBarOneAt,
  withOffset,
} from "@/domain/tempo/grid-edits";

const DURATION = 20;
const beats = Array.from({ length: 33 }, (_, i) => 1 + i * 0.5);
const grid = detectedGrid({ beats, downbeats: beats.filter((_, i) => i % 4 === 0) });

function downbeatTimes(target: BeatGrid): number[] {
  return target.downbeatIndices.map((i) => target.beats[i]);
}

function isAscending(values: readonly number[]): boolean {
  return values.every((value, i) => i === 0 || value > values[i - 1]);
}

describe("withOffset", () => {
  it("clamps to 200 ms either way and rounds to whole milliseconds", () => {
    expect(withOffset(grid, 250).offsetMs).toBe(200);
    expect(withOffset(grid, -250).offsetMs).toBe(-200);
    expect(withOffset(grid, 12.6).offsetMs).toBe(13);
  });

  it("survives halving and doubling", () => {
    expect(halved(withOffset(grid, 30)).offsetMs).toBe(30);
    expect(doubled(withOffset(grid, 30)).offsetMs).toBe(30);
  });
});

describe("withBarOneAt", () => {
  it("makes the beat at the playhead a downbeat", () => {
    expect(withBarOneAt(grid, 2).downbeatIndices).toEqual([2, 6, 10, 14, 18, 22, 26, 30]);
  });

  it("looks 150 ms ahead so a playhead resting just before a beat picks that beat", () => {
    expect(withBarOneAt(grid, 1.9).downbeatIndices[0]).toBe(2);
  });

  it("clamps before the first beat and after the last", () => {
    expect(withBarOneAt(grid, 0).downbeatIndices[0]).toBe(0);
    expect(withBarOneAt(grid, 99).downbeatIndices.at(-1)).toBe(32);
  });

  it("follows the offset", () => {
    expect(withBarOneAt(withOffset(grid, 100), 2.1).downbeatIndices[0]).toBe(2);
  });
});

describe("halve and double", () => {
  it("halving keeps the meter and every other bar", () => {
    const half = halved(grid);
    expect(half.beatsPerBar).toBe(4);
    expect(half.beats).toHaveLength(17);
    expect(downbeatTimes(half)).toEqual(downbeatTimes(grid).filter((_, i) => i % 2 === 0));
  });

  it("halves a bar of three too", () => {
    const waltz = detectedGrid({ beats, downbeats: beats.filter((_, i) => i % 3 === 0) });
    expect(canHalve(waltz)).toBe(true);
    expect(halved(waltz).beatsPerBar).toBe(3);
  });

  it("doubling keeps the meter and adds a bar in the middle of each bar", () => {
    const twice = doubled(grid);
    expect(twice.beatsPerBar).toBe(4);
    expect(twice.beats).toHaveLength(65);
    expect(twice.beats[1]).toBeCloseTo(1.25);
    expect(downbeatTimes(twice).filter((_, i) => i % 2 === 0)).toEqual(downbeatTimes(grid));
    expect(twice.downbeatIndices).toHaveLength(17);
  });

  it("cannot halve below 30 BPM", () => {
    const slow = Array.from({ length: 17 }, (_, i) => (i * 60) / 50);
    expect(canHalve(detectedGrid({ beats: slow, downbeats: slow.filter((_, i) => i % 4 === 0) }))).toBe(false);
  });

  it("cannot double past 240 BPM", () => {
    expect(canDouble(grid)).toBe(true);
    const fast = Array.from({ length: 9 }, (_, i) => (i * 60) / 121);
    expect(canDouble(detectedGrid({ beats: fast, downbeats: [0] }))).toBe(false);
  });

  it("halving a doubled grid gives the grid back", () => {
    expect(halved(doubled(grid))).toEqual(grid);
  });

  it("doubling a halved grid gives the grid back, with the last beat", () => {
    expect(doubled(halved(grid))).toEqual(grid);
    const twice = halved(halved(grid));
    expect(doubled(doubled(twice))).toEqual(grid);
  });

  it("doubling a halved manual grid gives the grid back", () => {
    const manual = manualGrid({ bpm: 81, beatsPerBar: 4, anchor: 2.3, end: DURATION });
    expect(doubled(halved(manual))).toEqual(manual);
  });

  it("keeps the bar the user set across halving and doubling", () => {
    const moved = withBarOneAt(grid, 2);
    expect(doubled(halved(moved))).toEqual(moved);
  });
});

describe("manualGrid", () => {
  const tempo = { bpm: 120, beatsPerBar: 4, anchor: 3.2, end: DURATION };
  const manual = manualGrid(tempo);

  it("puts a downbeat on the anchor", () => {
    expect(downbeatTimes(manual)).toContain(3.2);
  });

  it("covers the song from the first step to the end", () => {
    expect(manual.beats[0]).toBeGreaterThanOrEqual(0);
    expect(manual.beats[0]).toBeLessThan(0.5);
    expect(manual.beats.at(-1)).toBeLessThanOrEqual(DURATION);
    expect(DURATION - (manual.beats.at(-1) ?? 0)).toBeLessThan(0.5);
  });

  it("spaces bars by the beats per bar, also before the anchor", () => {
    const waltz = manualGrid({ bpm: 90, beatsPerBar: 3, anchor: 5, end: DURATION });
    const gaps = waltz.downbeatIndices.slice(1).map((v, i) => v - waltz.downbeatIndices[i]);
    expect(gaps.every((gap) => gap === 3)).toBe(true);
    expect(waltz.downbeatIndices[0]).toBeLessThan(3);
  });

  it("records the tempo as its origin", () => {
    expect(manual.source).toBe("manual");
    expect(manual.origin).toEqual(tempo);
  });
});

describe("reset and edited", () => {
  it("a fresh grid is not edited", () => {
    expect(isEdited(grid)).toBe(false);
    expect(isEdited(manualGrid({ bpm: 100, beatsPerBar: 4, anchor: 1, end: DURATION }))).toBe(false);
  });

  it("any edit marks the grid edited", () => {
    expect(isEdited(withOffset(grid, 10))).toBe(true);
    expect(isEdited(halved(grid))).toBe(true);
    expect(isEdited(withBarOneAt(grid, 2))).toBe(true);
  });

  it("reset undoes every edit of a detected grid", () => {
    const edited = withBarOneAt(halved(withOffset(grid, 40)), 3);
    expect(resetGrid(edited)).toEqual(grid);
  });

  it("reset rebuilds a manual grid from its tempo", () => {
    const manual = manualGrid({ bpm: 100, beatsPerBar: 4, anchor: 1, end: DURATION });
    expect(resetGrid(doubled(withOffset(manual, -20)))).toEqual(manual);
  });
});

describe("invariants", () => {
  it("no edit breaks the ascending order of beats or downbeats", () => {
    const edits = [withOffset(grid, 50), withBarOneAt(grid, 7), halved(grid), doubled(grid), resetGrid(grid)];
    for (const edited of edits) {
      expect(isAscending(edited.beats)).toBe(true);
      expect(isAscending(edited.downbeatIndices)).toBe(true);
      expect(edited.downbeatIndices.every((i) => i >= 0 && i < edited.beats.length)).toBe(true);
    }
  });

  it("edits never change the input grid", () => {
    const before = structuredClone(grid);
    withOffset(grid, 50);
    withBarOneAt(grid, 7);
    halved(grid);
    doubled(grid);
    expect(grid).toEqual(before);
    expect(beatTime(grid, 0)).toBe(1);
  });
});
