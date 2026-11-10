import { scrollWindowStart } from "@/views/timeline/scroll-window";

// -- Interfaces ----------------------------------------------------------------

interface RulerWindow {
  start: number;
  width: number;
}

// -- Constants -----------------------------------------------------------------

// Labelled interval and its minor tick, in seconds, from the closest zoom out.
const RULER_STEPS: readonly (readonly [labelled: number, minor: number])[] = [
  [1, 0.25],
  [2, 0.5],
  [5, 1],
  [10, 2.5],
  [15, 5],
  [30, 10],
  [60, 15],
];
const MIN_LABEL_SPACING_PX = 56;

// -- Functions -----------------------------------------------------------------

function rulerStep(zoom: number): readonly [number, number] {
  return (
    RULER_STEPS.find(([labelled]) => labelled * zoom >= MIN_LABEL_SPACING_PX) ?? RULER_STEPS[RULER_STEPS.length - 1]
  );
}

function rulerLabelCount(duration: number, labelled: number): number {
  return Math.floor(duration / labelled) + 1;
}

function rulerLabelTime(index: number, labelled: number): number {
  return index * labelled;
}

function rulerLabelTimes(duration: number, labelled: number): number[] {
  return Array.from({ length: rulerLabelCount(duration, labelled) }, (_, index) => rulerLabelTime(index, labelled));
}

// The window moves before the view nears its edge, so a render landing a frame late never shows a gap.
function rulerWindow(current: number, scrollLeft: number, viewportWidth: number, contentWidth: number): RulerWindow {
  const margin = Math.max(viewportWidth / 2, MIN_LABEL_SPACING_PX);
  const width = Math.ceil(viewportWidth + 4 * margin);
  const guardedStart = Math.max(0, Math.floor(scrollLeft - margin));
  const guardedEnd = Math.min(contentWidth, Math.ceil(scrollLeft + viewportWidth + margin));
  return { start: scrollWindowStart(current, guardedStart, guardedEnd, contentWidth, width), width };
}

function rulerLabelsInWindow(duration: number, labelled: number, zoom: number, window: RulerWindow): number[] {
  const spacing = labelled * zoom;
  if (spacing <= 0) return [];
  const first = Math.max(0, Math.ceil(window.start / spacing));
  const last = Math.min(rulerLabelCount(duration, labelled) - 1, Math.floor((window.start + window.width) / spacing));
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, offset) => rulerLabelTime(first + offset, labelled));
}

// -- Exports -------------------------------------------------------------------

export { MIN_LABEL_SPACING_PX, rulerLabelTimes, rulerLabelsInWindow, rulerStep, rulerWindow };
export type { RulerWindow };
