import { describe, expect, it } from "vitest";
import {
  GUTTER_WIDTH,
  REVEAL_MARGIN_PX,
  centerTimeScrollLeft,
  revealTimeScrollLeft,
  elementXToTime,
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

describe("elementXToTime", () => {
  function elementAt(left: number): HTMLElement {
    const element = document.createElement("div");
    element.getBoundingClientRect = () => ({ left }) as DOMRect;
    return element;
  }

  it("maps a clientX to seconds from the element's left edge", () => {
    expect(elementXToTime(250, elementAt(50), 100)).toBeCloseTo(2);
  });

  it("returns zero at the element's left edge", () => {
    expect(elementXToTime(50, elementAt(50), 100)).toBe(0);
  });

  it("scales with zoom", () => {
    expect(elementXToTime(250, elementAt(50), 50)).toBeCloseTo(4);
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

  it("follows the right edge just enough when the time is slightly past it", () => {
    expect(revealTimeScrollLeft(4.2, 100, 0, 500)).toBe(420 - (500 - GUTTER_WIDTH) + REVEAL_MARGIN_PX);
  });

  it("follows the left edge just enough when the time is slightly past it", () => {
    expect(revealTimeScrollLeft(1.2, 100, 100, 500)).toBe(120 - REVEAL_MARGIN_PX);
  });

  it("centers the time when it is far off the right edge", () => {
    expect(revealTimeScrollLeft(10, 100, 0, 500)).toBe(1000 + GUTTER_WIDTH - 250);
  });

  it("centers the time when it is far off the left edge", () => {
    expect(revealTimeScrollLeft(1, 100, 2000, 500)).toBe(0);
  });

  describe("invariants", () => {
    it("keeps a held step pinned at the margin, so the view glides", () => {
      const first = revealTimeScrollLeft(4.2, 100, 0, 500);
      expect(first).not.toBeNull();
      const second = revealTimeScrollLeft(4.7, 100, first ?? 0, 500);
      expect((second ?? 0) - (first ?? 0)).toBeCloseTo(50);
    });
  });

  describe("edge cases", () => {
    it("never scrolls before the song start", () => {
      expect(revealTimeScrollLeft(0.2, 100, 30, 500)).toBe(0);
    });

    it("honors a custom margin of zero, scrolling only when actually off-screen", () => {
      expect(revealTimeScrollLeft(4.5, 100, 0, 500, 0)).toBeNull();
      expect(revealTimeScrollLeft(4.53, 100, 0, 500, 0)).toBeCloseTo(453 - (500 - GUTTER_WIDTH));
    });
  });
});
