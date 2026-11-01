import { placeLoupe } from "@/views/timeline/loupe/place-loupe";
import { describe, expect, it } from "vitest";

const bounds = { left: 100, top: 50, right: 1300, bottom: 850 };
const size = { width: 440, height: 238 };

function laneAt(top: number) {
  return { left: 0, top, right: 4000, bottom: top + 44 };
}

function overlaps(a: { top: number; bottom: number }, b: { top: number; bottom: number }): boolean {
  return a.top < b.bottom && b.top < a.bottom;
}

describe("placeLoupe", () => {
  it("sits above the lane when there is room", () => {
    const lane = laneAt(500);
    const placed = placeLoupe({ anchorX: 700, lane, bounds, size });
    expect(placed.side).toBe("above");
    expect(placed.top).toBe(500 - 12 - 238);
    expect(placed.left).toBe(700 - 220);
    expect(placed.tailX).toBe(220);
  });

  it("flips below the lane when there is no room above", () => {
    const lane = laneAt(120);
    const placed = placeLoupe({ anchorX: 700, lane, bounds, size });
    expect(placed.side).toBe("below");
    expect(placed.top).toBe(lane.bottom + 12);
  });

  it("clamps to the left side and moves the tail to the anchor", () => {
    const placed = placeLoupe({ anchorX: 130, lane: laneAt(500), bounds, size });
    expect(placed.left).toBe(108);
    expect(placed.tailX).toBe(22);
  });

  it("clamps to the right side and keeps the tail inside the card", () => {
    const placed = placeLoupe({ anchorX: 1400, lane: laneAt(500), bounds, size });
    expect(placed.left).toBe(1300 - 8 - 440);
    expect(placed.tailX).toBe(440 - 20);
  });

  describe("invariants", () => {
    it("never covers the edited lane, even when neither side fits", () => {
      const tight = { left: 100, top: 50, right: 1300, bottom: 400 };
      for (const top of [60, 120, 200, 260, 330]) {
        const lane = laneAt(top);
        const placed = placeLoupe({ anchorX: 600, lane, bounds: tight, size });
        expect(overlaps({ top: placed.top, bottom: placed.top + size.height }, lane)).toBe(false);
      }
    });
  });
});
