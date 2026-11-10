import { heightAboveWindow, laneMove } from "@/views/sync/lane-window";
import { describe, expect, it } from "vitest";

describe("heightAboveWindow", () => {
  it("leaves the first mounted row where the full lane would put it", () => {
    const gap = 26;
    const heights = new Map([
      ["a", 40],
      ["b", 60],
    ]);
    const unmeasuredEstimate = 50;
    const fullLaneOffset = 40 + gap + 60 + gap + unmeasuredEstimate + gap;
    expect(heightAboveWindow(["a", "b", "c"], heights, gap) + gap).toBe(fullLaneOffset);
  });
});

describe("laneMove", () => {
  it("places the lane at once on mount and past the rows still mounted, and glides a short step", () => {
    expect(laneMove(null, 1400)).toBe("place");
    expect(laneMove(10, 11)).toBe("glide");
    expect(laneMove(10, 7)).toBe("glide");
    expect(laneMove(10, 400)).toBe("place");
  });
});
