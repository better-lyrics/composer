import { instanceStart, sharesTiming } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { instanceBounds } from "@/domain/instance/bounds";
import { instanceIndicesOf, linesOfInstance } from "@/domain/instance/enumerate";
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

function canHearInstance(lines: readonly LyricLine[], group: LinkGroup, instanceIdx: number): boolean {
  return sharesTiming(group, instanceIdx) && instanceStart(lines, group.id, instanceIdx) !== null;
}

function adjacentHeardInstance(
  lines: readonly LyricLine[],
  group: LinkGroup,
  heardInstanceIdx: number,
  direction: 1 | -1,
): number | null {
  if (!canHearInstance(lines, group, heardInstanceIdx)) return null;
  const heard = instanceIndicesOf(lines, group.id).filter((instanceIdx) => canHearInstance(lines, group, instanceIdx));
  if (heard.length < 2) return null;
  const here = heard.indexOf(heardInstanceIdx);
  return heard[(here + direction + heard.length) % heard.length];
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

export {
  FOCUS_SCROLL_MARGIN_PX,
  adjacentHeardInstance,
  canHearInstance,
  clampScrollLeft,
  effectiveFocus,
  focusBounds,
  focusScrollRange,
  isInFocus,
};
export type { GroupFocus, ScrollRange };
