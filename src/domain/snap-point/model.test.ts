import { describe, expect, it } from "vitest";
import {
  createSnapPoint,
  normalizeSnapPoints,
  normalizeTimes,
  type SnapPoint,
  snapPointTimes,
  toSnapPoints,
} from "@/domain/snap-point/model";

// -- createSnapPoint ----------------------------------------------------------

describe("createSnapPoint", () => {
  it("wraps a time in a SnapPoint with an id", () => {
    const point = createSnapPoint(12.5);
    expect(point.time).toBe(12.5);
    expect(typeof point.id).toBe("string");
    expect(point.id).toHaveLength(8);
  });

  it("mints a unique id for two calls with the same time", () => {
    const a = createSnapPoint(3);
    const b = createSnapPoint(3);
    expect(a.id).not.toBe(b.id);
    expect(a.time).toBe(b.time);
  });
});

// -- toSnapPoints -------------------------------------------------------------

describe("toSnapPoints", () => {
  it("coerces numbers into fresh SnapPoints", () => {
    const result = toSnapPoints([1, 2, 3]);
    expect(result.map((p) => p.time)).toEqual([1, 2, 3]);
    for (const point of result) {
      expect(point.id).toHaveLength(8);
    }
  });

  it("passes existing SnapPoints through, preserving their id", () => {
    const existing: SnapPoint = { id: "keepthis", time: 4 };
    const [result] = toSnapPoints([existing]);
    expect(result.id).toBe("keepthis");
    expect(result.time).toBe(4);
  });

  it("returns a fresh object even for a valid passthrough (no identity stability)", () => {
    const existing: SnapPoint = { id: "keepthis", time: 4 };
    const [result] = toSnapPoints([existing]);
    expect(result).not.toBe(existing);
  });

  it("mints a fresh id for objects with a finite time but a non-string id", () => {
    const malformed = { id: undefined as unknown as string, time: 7 };
    const [result] = toSnapPoints([malformed]);
    expect(typeof result.id).toBe("string");
    expect(result.id).toHaveLength(8);
    expect(result.time).toBe(7);
  });

  it("mints a fresh id for objects with an empty-string id", () => {
    const malformed: SnapPoint = { id: "", time: 9 };
    const [result] = toSnapPoints([malformed]);
    expect(result.id).not.toBe("");
    expect(result.id).toHaveLength(8);
    expect(result.time).toBe(9);
  });

  it("passes non-finite times through (filtering is normalize's job)", () => {
    const result = toSnapPoints([Number.NaN]);
    expect(result).toHaveLength(1);
    expect(Number.isNaN(result[0].time)).toBe(true);
    expect(result[0].id).toHaveLength(8);
  });
});

// -- snapPointTimes -----------------------------------------------------------

describe("snapPointTimes", () => {
  it("extracts the time of each point, preserving order", () => {
    const points: SnapPoint[] = [
      { id: "a", time: 5 },
      { id: "b", time: 1 },
      { id: "c", time: 3 },
    ];
    expect(snapPointTimes(points)).toEqual([5, 1, 3]);
  });
});

// -- normalizeTimes -----------------------------------------------------------

describe("normalizeTimes", () => {
  it("filters invalid times and sorts ascending", () => {
    expect(normalizeTimes([5, 1, 3])).toEqual([1, 3, 5]);
  });
});

// -- normalizeSnapPoints ------------------------------------------------------

describe("normalizeSnapPoints", () => {
  it("coerces, filters, and sorts by time", () => {
    const result = normalizeSnapPoints([5, { id: "x", time: 1 }, 3]);
    expect(result.map((p) => p.time)).toEqual([1, 3, 5]);
    expect(result.find((p) => p.time === 1)?.id).toBe("x");
  });
});

// -- edge cases ---------------------------------------------------------------

describe("edge cases", () => {
  it("returns an empty array for empty input", () => {
    expect(toSnapPoints([])).toEqual([]);
    expect(snapPointTimes([])).toEqual([]);
    expect(normalizeTimes([])).toEqual([]);
    expect(normalizeSnapPoints([])).toEqual([]);
  });

  it("handles a single item", () => {
    expect(normalizeTimes([42])).toEqual([42]);
    expect(normalizeSnapPoints([42]).map((p) => p.time)).toEqual([42]);
  });

  it("leaves an already-sorted array sorted", () => {
    expect(normalizeTimes([1, 2, 3])).toEqual([1, 2, 3]);
    expect(normalizeSnapPoints([1, 2, 3]).map((p) => p.time)).toEqual([1, 2, 3]);
  });

  it("sorts a reverse-sorted array", () => {
    expect(normalizeTimes([3, 2, 1])).toEqual([1, 2, 3]);
    expect(normalizeSnapPoints([3, 2, 1]).map((p) => p.time)).toEqual([1, 2, 3]);
  });

  it("drops negative times", () => {
    expect(normalizeTimes([-1, 2, -3])).toEqual([2]);
    expect(normalizeSnapPoints([-1, 2, -3]).map((p) => p.time)).toEqual([2]);
  });

  it("keeps zero time", () => {
    expect(normalizeTimes([0, 1])).toEqual([0, 1]);
    expect(normalizeSnapPoints([0, 1]).map((p) => p.time)).toEqual([0, 1]);
  });

  it("drops NaN, Infinity, and -Infinity", () => {
    expect(normalizeTimes([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 5])).toEqual([5]);
    expect(
      normalizeSnapPoints([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 5]).map((p) => p.time),
    ).toEqual([5]);
  });

  it("keeps duplicate times (no dedupe)", () => {
    expect(normalizeTimes([2, 1, 2, 1])).toEqual([1, 1, 2, 2]);
    expect(normalizeSnapPoints([2, 1, 2, 1]).map((p) => p.time)).toEqual([1, 1, 2, 2]);
  });
});

// -- invariants ---------------------------------------------------------------

describe("invariants", () => {
  it("does not mutate the input array for toSnapPoints", () => {
    const input: ReadonlyArray<number> = [3, 1, 2];
    const snapshot = [...input];
    toSnapPoints(input);
    expect(input).toEqual(snapshot);
  });

  it("does not mutate input SnapPoint objects", () => {
    const original: SnapPoint = { id: "keep", time: 4 };
    const frozen = Object.freeze({ ...original });
    const [result] = toSnapPoints([frozen]);
    expect(frozen).toEqual(original);
    expect(result).not.toBe(frozen);
  });

  it("does not mutate the input array for normalizeTimes", () => {
    const input: ReadonlyArray<number> = [3, 1, 2];
    const snapshot = [...input];
    normalizeTimes(input);
    expect(input).toEqual(snapshot);
  });

  it("returns a new array from normalizeTimes", () => {
    const input = [1, 2, 3];
    expect(normalizeTimes(input)).not.toBe(input);
  });

  it("returns a new array from toSnapPoints", () => {
    const input: SnapPoint[] = [{ id: "a", time: 1 }];
    expect(toSnapPoints(input)).not.toBe(input);
  });

  it("preserves ids through normalizeSnapPoints", () => {
    const input: SnapPoint[] = [
      { id: "second", time: 5 },
      { id: "first", time: 1 },
    ];
    const result = normalizeSnapPoints(input);
    expect(result.map((p) => p.id)).toEqual(["first", "second"]);
  });

  it("keeps a stable order for equal times in normalizeSnapPoints", () => {
    const input: SnapPoint[] = [
      { id: "a", time: 2 },
      { id: "b", time: 2 },
      { id: "c", time: 2 },
    ];
    const result = normalizeSnapPoints(input);
    expect(result.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("mints unique ids across many createSnapPoint calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createSnapPoint(0).id);
    }
    expect(ids.size).toBe(100);
  });
});

// -- cross-type ---------------------------------------------------------------

describe("cross-type", () => {
  it("handles a mixed array of numbers and SnapPoint objects in toSnapPoints", () => {
    const result = toSnapPoints([2, { id: "obj", time: 5 }, 1]);
    expect(result.map((p) => p.time)).toEqual([2, 5, 1]);
    expect(result[1].id).toBe("obj");
    expect(result[0].id).toHaveLength(8);
    expect(result[2].id).toHaveLength(8);
  });

  it("handles a mixed array correctly through normalizeSnapPoints", () => {
    const result = normalizeSnapPoints([2, { id: "obj", time: 5 }, 1, { id: "neg", time: -4 }]);
    expect(result.map((p) => p.time)).toEqual([1, 2, 5]);
    expect(result.find((p) => p.time === 5)?.id).toBe("obj");
  });
});
