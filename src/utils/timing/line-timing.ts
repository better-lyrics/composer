import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
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
) {
  const line = lines[lineIdx];
  if (line?.begin === undefined) return;

  const range = timeRangeResolver(lines, groups, Number.POSITIVE_INFINITY)(line);
  updateLineWithHistory(line.id, shiftLineTiming(line, delta, range), { propagateToSiblings: false });
}

function setLineBegin(
  lines: LyricLine[],
  lineIdx: number,
  newBegin: number,
  updateLineWithHistory: UpdateLineWithHistory,
  groups: readonly LinkGroup[] = [],
) {
  const begin = lines[lineIdx]?.begin;
  if (begin === undefined) return;

  nudgeLineBegin(lines, lineIdx, newBegin - begin, updateLineWithHistory, groups);
}

export { nudgeLineBegin, setLineBegin };
