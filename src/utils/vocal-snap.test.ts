import { getTapSyncSnapThresholdSeconds, resolveVocalOnsetSnap } from "@/utils/vocal-snap";
import { describe, expect, it } from "vitest";

describe("resolveVocalOnsetSnap", () => {
  it("snaps to the nearest vocal onset within threshold", () => {
    expect(resolveVocalOnsetSnap(1.04, [0.5, 1.0, 1.2], 0.06)).toEqual({ time: 1.0, snapped: true });
  });

  it("keeps the raw tap when no vocal onset is close enough", () => {
    expect(resolveVocalOnsetSnap(1.09, [1.0], 0.06)).toEqual({ time: 1.09, snapped: false });
  });

  it("uses the closest side of the insertion point", () => {
    expect(resolveVocalOnsetSnap(1.08, [1.0, 1.1], 0.12)).toEqual({ time: 1.1, snapped: true });
  });
});

describe("getTapSyncSnapThresholdSeconds", () => {
  it("converts the timeline snap threshold from pixels to seconds", () => {
    expect(getTapSyncSnapThresholdSeconds(100, 12)).toBeCloseTo(0.12);
    expect(getTapSyncSnapThresholdSeconds(200, 12)).toBeCloseTo(0.06);
  });

  it("clamps extreme zoom-derived thresholds", () => {
    expect(getTapSyncSnapThresholdSeconds(20, 12)).toBe(0.12);
    expect(getTapSyncSnapThresholdSeconds(1000, 12)).toBe(0.02);
  });
});
