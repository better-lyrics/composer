import { WAVEFORM_WINDOW_WIDTH, waveformWindowStart } from "@/views/timeline/waveform-window";
import { describe, expect, it } from "vitest";

const SONG_WIDTH = 120_000;

function covers(start: number, visibleStart: number, visibleEnd: number): boolean {
  return start <= visibleStart && start + WAVEFORM_WINDOW_WIDTH >= visibleEnd;
}

describe("waveformWindowStart", () => {
  it("keeps the window while the view stays inside it", () => {
    expect(waveformWindowStart(4000, 5000, 6400, SONG_WIDTH)).toBe(4000);
  });

  it("centres the window on the view once the view leaves it", () => {
    expect(waveformWindowStart(0, 20_000, 21_400, SONG_WIDTH)).toBe(16_700);
  });

  describe("edge cases", () => {
    it("starts at 0 for a song narrower than the window", () => {
      expect(waveformWindowStart(300, 100, 1500, 6000)).toBe(0);
    });

    it("stops at the song end, where WaveSurfer cannot scroll further", () => {
      expect(waveformWindowStart(0, SONG_WIDTH - 1400, SONG_WIDTH, SONG_WIDTH)).toBe(SONG_WIDTH - WAVEFORM_WINDOW_WIDTH);
    });

    it("moves a window left past the end of a song that got shorter after a zoom out", () => {
      expect(waveformWindowStart(100_000, 30_000, 31_400, 40_000)).toBe(30_000 - (WAVEFORM_WINDOW_WIDTH - 1400) / 2);
    });
  });

  describe("invariants", () => {
    it("always covers the view and stays scrollable, whatever the previous window", () => {
      for (const current of [0, 3333, 50_000, 119_000]) {
        for (let visibleStart = 0; visibleStart + 2500 <= SONG_WIDTH; visibleStart += 1777.5) {
          const start = waveformWindowStart(current, visibleStart, visibleStart + 2500, SONG_WIDTH);
          expect(Number.isInteger(start)).toBe(true);
          expect(start).toBeLessThanOrEqual(SONG_WIDTH - WAVEFORM_WINDOW_WIDTH);
          expect(covers(start, Math.floor(visibleStart), Math.ceil(visibleStart + 2500))).toBe(true);
        }
      }
    });
  });
});
