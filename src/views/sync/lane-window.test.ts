import { heightAboveWindow } from "@/views/sync/lane-window";
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
