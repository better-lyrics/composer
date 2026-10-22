import { describe, expect, it } from "vitest";
import { isResumePosition } from "@/domain/project/resume-position";

describe("isResumePosition", () => {
  it("accepts a time and zoom, with or without a scroll", () => {
    expect(isResumePosition({ time: 12.5, zoom: 150 })).toBe(true);
    expect(isResumePosition({ time: 0, zoom: 100, scroll: { left: 300, top: 40 } })).toBe(true);
  });

  describe("edge cases", () => {
    it.each([
      undefined,
      null,
      "x",
      { time: Number.NaN, zoom: 100 },
      { time: -1, zoom: 100 },
      { time: 1, zoom: 0 },
      { time: 1, zoom: Number.POSITIVE_INFINITY },
      { time: 1 },
      { time: 1, zoom: 100, scroll: { left: "a", top: 0 } },
      { time: 1, zoom: 100, scroll: { left: 0, top: -5 } },
      { time: 1, zoom: 100, scroll: null },
    ])("rejects %j", (value) => {
      expect(isResumePosition(value)).toBe(false);
    });
  });
});
