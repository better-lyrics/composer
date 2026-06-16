import { describe, expect, it } from "vitest";
import {
  GUTTER_WIDTH,
  REVEAL_MARGIN_PX,
  centerTimeScrollLeft,
  revealTimeScrollLeft,
  timeToX,
  xToTime,
} from "@/views/timeline/coords";

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

describe("centerTimeScrollLeft", () => {
  it("places the time at the horizontal center of the viewport", () => {
    expect(centerTimeScrollLeft(10, 100, 500)).toBe(1000 + GUTTER_WIDTH - 250);
  });

  it("clamps to zero when centering would scroll past the start", () => {
    expect(centerTimeScrollLeft(0, 100, 500)).toBe(0);
    expect(centerTimeScrollLeft(1, 100, 5000)).toBe(0);
  });

  it("accounts for the gutter so the centered time matches timeToX at viewport center", () => {
    const time = 12;
    const zoom = 80;
    const clientWidth = 600;
    const scrollLeft = centerTimeScrollLeft(time, zoom, clientWidth);
    expect(timeToX(time, zoom, scrollLeft)).toBeCloseTo(clientWidth / 2);
  });
});

describe("revealTimeScrollLeft", () => {
  it("returns null when the time sits comfortably inside the viewport", () => {
    expect(revealTimeScrollLeft(2, 100, 0, 500)).toBeNull();
  });

  it("centers the playhead when the time is off the right edge", () => {
    expect(revealTimeScrollLeft(10, 100, 0, 500)).toBe(1000 + GUTTER_WIDTH - 250);
  });

  it("centers the playhead when the time is off the left edge", () => {
    expect(revealTimeScrollLeft(1, 100, 2000, 500)).toBe(0);
  });

  it("re-centers before the playhead reaches the right edge (within the margin)", () => {
    expect(revealTimeScrollLeft(4.2, 100, 0, 500)).toBe(420 + GUTTER_WIDTH - 250);
  });

  it("re-centers before the playhead reaches the left edge (within the margin)", () => {
    expect(revealTimeScrollLeft(1.2, 100, 100, 500)).toBe(0);
  });

  describe("edge cases", () => {
    it("clamps the centered scroll position to zero", () => {
      expect(revealTimeScrollLeft(0, 100, 0, 500)).toBe(0);
    });

    it("honors a custom margin of zero, scrolling only when actually off-screen", () => {
      expect(revealTimeScrollLeft(4.5, 100, 0, 500, 0)).toBeNull();
      expect(revealTimeScrollLeft(4.53, 100, 0, 500, 0)).toBe(453 + GUTTER_WIDTH - 250);
    });

    it("defaults the margin to REVEAL_MARGIN_PX", () => {
      const withDefault = revealTimeScrollLeft(4.2, 100, 0, 500);
      const withExplicit = revealTimeScrollLeft(4.2, 100, 0, 500, REVEAL_MARGIN_PX);
      expect(withDefault).toBe(withExplicit);
    });
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
