import { detectedGrid } from "@/domain/tempo/beat-grid";
import { gridDensity, gridPointAt, gridPointLabel, gridPoints } from "@/domain/tempo/grid-points";
import { describe, expect, it } from "vitest";

const beats = Array.from({ length: 17 }, (_, i) => i * 0.5);
const grid120 = detectedGrid({ beats, downbeats: beats.filter((_, i) => i % 4 === 0) });

describe("gridDensity", () => {
  it("shows 1/2 lines when each half beat has at least 14 px", () => {
    expect(gridDensity(grid120, 56, "2")).toEqual({ beats: true, division: 2, thinned: false });
  });

  it("drops subdivisions under 14 px but keeps beats at 10 px or more", () => {
    expect(gridDensity(grid120, 40, "4")).toEqual({ beats: true, division: 1, thinned: true });
  });

  it("drops beats under 10 px and keeps bars", () => {
    expect(gridDensity(grid120, 19, "1")).toEqual({ beats: false, division: 1, thinned: true });
  });

  it("never reports thinning for bar lines", () => {
    expect(gridDensity(grid120, 1, "bar")).toEqual({ beats: false, division: 1, thinned: false });
  });
});

describe("gridPoints", () => {
  it("returns bars, beats and subdivisions in order", () => {
    const points = gridPoints(grid120, 0, 1, 200, "2");
    expect(points.map((p) => [p.t, p.kind])).toEqual([
      [0, "bar"],
      [0.25, "sub"],
      [0.5, "beat"],
      [0.75, "sub"],
      [1, "beat"],
      [1.25, "sub"],
    ]);
  });

  it("starts at the beat before the range so its subdivisions are kept", () => {
    expect(gridPoints(grid120, 0.6, 0.8, 200, "2").map((p) => p.t)).toEqual([0.5, 0.75]);
  });

  it("numbers bars", () => {
    const bars = gridPoints(grid120, 0, 8, 200, "bar");
    expect(bars.map((p) => [p.t, p.bar])).toEqual([
      [0, 1],
      [2, 2],
      [4, 3],
      [6, 4],
      [8, 5],
    ]);
  });

  it("keeps only bar lines when zoomed far out", () => {
    expect(gridPoints(grid120, 0, 8, 1, "4").every((p) => p.kind === "bar")).toBe(true);
  });

  it("adds no subdivisions after the last beat", () => {
    expect(gridPoints(grid120, 8, 99, 200, "4").map((p) => p.t)).toEqual([8]);
  });

  it("follows the offset", () => {
    expect(gridPoints({ ...grid120, offsetMs: 100 }, 0, 0.2, 200, "1")[0].t).toBeCloseTo(0.1);
  });

  it("is empty for an empty grid", () => {
    expect(gridPoints({ ...grid120, beats: [], downbeatIndices: [] }, 0, 10, 200, "2")).toEqual([]);
  });

  it("gives each subdivision its own note value, so the middle 1/4 tick is a half beat", () => {
    const subs = gridPoints(grid120, 0, 0.49, 200, "4").filter((p) => p.kind === "sub");
    expect(subs.map((p) => p.division)).toEqual([4, 2, 4]);
  });
});

describe("labels and lookup", () => {
  it("labels points", () => {
    expect(gridPointLabel({ t: 0, kind: "bar", bar: 7, division: 1 })).toBe("Bar 7");
    expect(gridPointLabel({ t: 0, kind: "beat", bar: 7, division: 1 })).toBe("Beat");
    expect(gridPointLabel({ t: 0, kind: "sub", bar: 7, division: 3 })).toBe("1/3");
  });

  it("finds the point at a time", () => {
    const points = gridPoints(grid120, 0, 2, 200, "2");
    expect(gridPointAt(points, 0.75)?.kind).toBe("sub");
    expect(gridPointAt(points, 2)?.bar).toBe(2);
    expect(gridPointAt(points, 0.7)).toBeNull();
  });
});
