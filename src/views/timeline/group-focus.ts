import { instanceBounds } from "@/domain/instance/bounds";
import { linesOfInstance } from "@/domain/instance/enumerate";
import { belongsToInstance } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import type { Bounds } from "@/domain/word/bounds";

// -- Types --------------------------------------------------------------------

interface GroupFocus {
  groupId: string;
  hearInstanceIdx: number;
}

interface ScrollRange {
  min: number;
  max: number;
}

// -- Constants ----------------------------------------------------------------

const FOCUS_SCROLL_MARGIN_PX = 64;

// -- Functions ----------------------------------------------------------------

function isInFocus(line: LyricLine, focus: GroupFocus | null): boolean {
  return focus === null || belongsToInstance(line, focus.groupId, focus.hearInstanceIdx);
}

function effectiveFocus(lines: readonly LyricLine[], focus: GroupFocus | null): GroupFocus | null {
  if (focus === null) return null;
  return lines.some((line) => isInFocus(line, focus)) ? focus : null;
}

function focusBounds(lines: readonly LyricLine[], focus: GroupFocus): Bounds | null {
  return instanceBounds(linesOfInstance(lines, focus.groupId, focus.hearInstanceIdx));
}

function focusScrollRange(span: Bounds, zoom: number, visibleTrackWidth: number): ScrollRange {
  const min = Math.max(0, span.begin * zoom - FOCUS_SCROLL_MARGIN_PX);
  const max = Math.max(min, span.end * zoom + FOCUS_SCROLL_MARGIN_PX - visibleTrackWidth);
  return { min, max };
}

function clampScrollLeft(scrollLeft: number, range: ScrollRange): number {
  return Math.min(range.max, Math.max(range.min, scrollLeft));
}

// -- Exports ------------------------------------------------------------------

export { FOCUS_SCROLL_MARGIN_PX, clampScrollLeft, effectiveFocus, focusBounds, focusScrollRange, isInFocus };
export type { GroupFocus, ScrollRange };
