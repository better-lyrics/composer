import { scrollWindowStart } from "@/views/timeline/scroll-window";
import { describe, expect, it } from "vitest";

const SONG_WIDTH = 120_000;
const WINDOW_WIDTH = 8000;

function windowStart(current: number, visibleStart: number, visibleEnd: number, contentWidth: number): number {
  return scrollWindowStart(current, visibleStart, visibleEnd, contentWidth, WINDOW_WIDTH);
}

function covers(start: number, visibleStart: number, visibleEnd: number): boolean {
  return start <= visibleStart && start + WINDOW_WIDTH >= visibleEnd;
}

describe("waveformWindowStart", () => {
  it("keeps the window while the view stays inside it", () => {
    expect(windowStart(4000, 5000, 6400, SONG_WIDTH)).toBe(4000);
  });

  it("centres the window on the view once the view leaves it", () => {
    expect(windowStart(0, 20_000, 21_400, SONG_WIDTH)).toBe(16_700);
  });

  describe("edge cases", () => {
    it("starts at 0 for a song narrower than the window", () => {
      expect(windowStart(300, 100, 1500, 6000)).toBe(0);
    });

    it("stops at the song end, where the content ends", () => {
      expect(windowStart(0, SONG_WIDTH - 1400, SONG_WIDTH, SONG_WIDTH)).toBe(
        SONG_WIDTH - WINDOW_WIDTH,
      );
    });

    it("moves a window left past the end of a song that got shorter after a zoom out", () => {
      expect(windowStart(100_000, 30_000, 31_400, 40_000)).toBe(30_000 - (WINDOW_WIDTH - 1400) / 2);
    });
  });

  describe("invariants", () => {
    it("always covers the view and stays scrollable, whatever the previous window", () => {
      for (const current of [0, 3333, 50_000, 119_000]) {
        for (let visibleStart = 0; visibleStart + 2500 <= SONG_WIDTH; visibleStart += 1777.5) {
          const start = windowStart(current, visibleStart, visibleStart + 2500, SONG_WIDTH);
          expect(Number.isInteger(start)).toBe(true);
          expect(start).toBeLessThanOrEqual(SONG_WIDTH - WINDOW_WIDTH);
          expect(covers(start, Math.floor(visibleStart), Math.ceil(visibleStart + 2500))).toBe(true);
        }
      }
    });
  });
});
