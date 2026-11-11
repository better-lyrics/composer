import {
  MIN_LABEL_SPACING_PX,
  type RulerWindow,
  rulerLabelTimes,
  rulerLabelsInWindow,
  rulerStep,
  rulerWindow,
} from "@/views/timeline/ruler-labels";
import { describe, expect, it } from "vitest";

const VIEWPORT_WIDTH = 1180;
const DURATIONS = [0, 7.3, 240, 3600];
const ZOOMS = [20, 60, 140, 980];

function scrollPositions(contentWidth: number): number[] {
  const maxScroll = Math.max(0, contentWidth - VIEWPORT_WIDTH);
  const steps = 40;
  return Array.from({ length: steps + 1 }, (_, index) => (maxScroll * index) / steps + (index % 3) * 0.37).map(
    (position) => Math.min(maxScroll, position),
  );
}

describe("rulerLabelsInWindow", () => {
  it("holds every label that reaches the view, at the same time and offset as the full list", () => {
    for (const duration of DURATIONS) {
      for (const zoom of ZOOMS) {
        const [labelled] = rulerStep(zoom);
        const contentWidth = duration * zoom;
        const full = rulerLabelTimes(duration, labelled);
        let window: RulerWindow | null = null;
        for (const scrollLeft of [...scrollPositions(contentWidth), ...scrollPositions(contentWidth).reverse()]) {
          window = rulerWindow(window?.start ?? 0, scrollLeft, VIEWPORT_WIDTH, contentWidth);
          const windowed = rulerLabelsInWindow(duration, labelled, zoom, window);
          const reachingView = full.filter(
            (time) => time * zoom >= scrollLeft - MIN_LABEL_SPACING_PX && time * zoom <= scrollLeft + VIEWPORT_WIDTH,
          );
          expect(windowed).toEqual(expect.arrayContaining(reachingView));
          expect(full).toEqual(expect.arrayContaining(windowed));
          expect(windowed.length).toBeLessThanOrEqual(Math.ceil(window.width / (labelled * zoom)) + 2);
        }
      }
    }
  });
});
