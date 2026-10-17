import type { Bounds } from "@/domain/word/bounds";
import { OUTSIDE_FOCUS_ATTRIBUTE } from "@/views/preview/lyrics-layout";
import { type RefObject, useEffect, useEffectEvent } from "react";

// -- Interfaces ----------------------------------------------------------------

interface TimedLineElement {
  element: Element;
  startSeconds: number;
}

// -- Constants -----------------------------------------------------------------

const FOCUS_EDGE_TOLERANCE_SECONDS = 0.005;

// -- Functions -----------------------------------------------------------------

function isOutsideFocus(time: number, range: Bounds): boolean {
  return time < range.begin - FOCUS_EDGE_TOLERANCE_SECONDS || time > range.end + FOCUS_EDGE_TOLERANCE_SECONDS;
}

function markLinesOutsideFocus(lines: Iterable<TimedLineElement>, range: Bounds | null): void {
  for (const { element, startSeconds } of lines) {
    element.toggleAttribute(OUTSIDE_FOCUS_ATTRIBUTE, range !== null && isOutsideFocus(startSeconds, range));
  }
}

// -- Hooks ---------------------------------------------------------------------

// Keeps `latestRangeRef` current so a renderer can re-mark the lines it rebuilds later.
function useFocusFade(
  focusRange: Bounds | null,
  latestRangeRef: RefObject<Bounds | null>,
  markLines: (range: Bounds | null) => void,
): void {
  const markOnChange = useEffectEvent(markLines);
  const begin = focusRange?.begin;
  const end = focusRange?.end;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Effect Events always read current state and must not be dependencies.
  useEffect(() => {
    const range = begin === undefined || end === undefined ? null : { begin, end };
    latestRangeRef.current = range;
    markOnChange(range);
  }, [begin, end, latestRangeRef]);
}

// -- Exports -------------------------------------------------------------------

export { isOutsideFocus, markLinesOutsideFocus, useFocusFade };
export type { TimedLineElement };
