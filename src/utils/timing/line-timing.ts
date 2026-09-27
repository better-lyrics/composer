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
) {
  const line = lines[lineIdx];
  if (line?.begin === undefined) return;

  updateLineWithHistory(line.id, shiftLineTiming(line, delta), { propagateToSiblings: false });
}

function setLineBegin(
  lines: LyricLine[],
  lineIdx: number,
  newBegin: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const begin = lines[lineIdx]?.begin;
  if (begin === undefined) return;

  nudgeLineBegin(lines, lineIdx, newBegin - begin, updateLineWithHistory);
}

export { nudgeLineBegin, setLineBegin };
