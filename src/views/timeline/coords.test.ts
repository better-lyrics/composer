import { describe, expect, it } from "vitest";
import { GUTTER_WIDTH, timeToX, xToTime } from "@/views/timeline/coords";

describe("timeToX", () => {
  it("maps seconds to gutter-offset pixels", () => {
    expect(timeToX(2, 100, 50)).toBe(2 * 100 - 50 + GUTTER_WIDTH);
  });

  it("subtracts scrollLeft", () => {
    expect(timeToX(1, 100, 0)).toBe(100 + GUTTER_WIDTH);
    expect(timeToX(1, 100, 40)).toBe(100 - 40 + GUTTER_WIDTH);
  });

  it("returns the gutter width at time zero with no scroll", () => {
    expect(timeToX(0, 100, 0)).toBe(GUTTER_WIDTH);
  });
});

describe("xToTime", () => {
  it("inverts a clientX against a viewport rect", () => {
    const rect = { left: 10 } as DOMRect;
    expect(xToTime(10 + GUTTER_WIDTH + 100, rect, 100, 0)).toBeCloseTo(1);
  });

  it("clamps to >= 0", () => {
    expect(xToTime(0, { left: 999 } as DOMRect, 100, 0)).toBe(0);
  });

  it("accounts for scrollLeft", () => {
    const rect = { left: 0 } as DOMRect;
    expect(xToTime(GUTTER_WIDTH, rect, 100, 200)).toBeCloseTo(2);
  });
});

describe("edge cases", () => {
  it("handles a negative scrollLeft in timeToX", () => {
    expect(timeToX(1, 100, -50)).toBe(100 + 50 + GUTTER_WIDTH);
  });

  it("handles a negative scrollLeft in xToTime", () => {
    const rect = { left: 0 } as DOMRect;
    expect(xToTime(GUTTER_WIDTH + 100, rect, 100, -100)).toBeCloseTo(0);
  });

  it("handles large time and zoom values", () => {
    expect(timeToX(3600, 500, 0)).toBe(3600 * 500 + GUTTER_WIDTH);
  });

  it("handles fractional seconds", () => {
    expect(timeToX(1.5, 80, 0)).toBe(1.5 * 80 + GUTTER_WIDTH);
  });

  it("clamps when clientX lands left of the gutter", () => {
    const rect = { left: 0 } as DOMRect;
    expect(xToTime(GUTTER_WIDTH - 10, rect, 100, 0)).toBe(0);
  });
});

describe("invariants", () => {
  const cases: Array<{ t: number; zoom: number; scrollLeft: number }> = [
    { t: 0, zoom: 100, scrollLeft: 0 },
    { t: 1, zoom: 100, scrollLeft: 50 },
    { t: 2.5, zoom: 80, scrollLeft: 0 },
    { t: 12.345, zoom: 250, scrollLeft: 400 },
    { t: 60, zoom: 33, scrollLeft: -120 },
  ];

  it("round-trips time -> x -> time for representative values", () => {
    const rect = { left: 17 } as DOMRect;
    for (const { t, zoom, scrollLeft } of cases) {
      const x = timeToX(t, zoom, scrollLeft) + rect.left;
      expect(xToTime(x, rect, zoom, scrollLeft)).toBeCloseTo(t);
    }
  });

  it("xToTime is the algebraic inverse of timeToX above the clamp floor", () => {
    const rect = { left: 0 } as DOMRect;
    const t = 5;
    const zoom = 120;
    const scrollLeft = 30;
    const x = timeToX(t, zoom, scrollLeft);
    expect(xToTime(x, rect, zoom, scrollLeft)).toBeCloseTo(t);
  });

  it("never returns a negative time", () => {
    const rect = { left: 500 } as DOMRect;
    for (let clientX = -1000; clientX <= 1000; clientX += 250) {
      expect(xToTime(clientX, rect, 100, 0)).toBeGreaterThanOrEqual(0);
    }
  });
});
