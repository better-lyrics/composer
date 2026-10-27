import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { shiftLineTiming } from "@/domain/line/shift";

type UpdateLineWithHistory = (
  id: string,
  updates: Partial<LyricLine>,
  options?: { propagateToSiblings?: boolean },
) => void;

function nudgeLineBegin(
  lines: LyricLine[],
  lineIdx: number,
  delta: number,
  updateLineWithHistory: UpdateLineWithHistory,
  groups: readonly LinkGroup[] = [],
  duration = Number.POSITIVE_INFINITY,
) {
  const line = lines[lineIdx];
  if (!line || !effectiveBounds(line)) return;

  const range = timeRangeResolver(lines, groups, duration)(line);
  updateLineWithHistory(line.id, shiftLineTiming(line, delta, range), { propagateToSiblings: false });
}

function setLineBegin(
  lines: LyricLine[],
  lineIdx: number,
  newBegin: number,
  updateLineWithHistory: UpdateLineWithHistory,
  groups: readonly LinkGroup[] = [],
  duration = Number.POSITIVE_INFINITY,
) {
  const line = lines[lineIdx];
  const bounds = line && effectiveBounds(line);
  if (!bounds) return;

  nudgeLineBegin(lines, lineIdx, newBegin - bounds.begin, updateLineWithHistory, groups, duration);
}

export { nudgeLineBegin, setLineBegin };
