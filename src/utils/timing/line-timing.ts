import { mainBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";

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
  if (!line || !isLineSynced(line)) return;
  const mb = mainBounds(line);
  if (!mb) return;

  const newBegin = Math.max(0, mb.begin + delta);
  const duration = mb.end - mb.begin;
  updateLineWithHistory(line.id, { begin: newBegin, end: newBegin + duration }, { propagateToSiblings: false });
}

function setLineBegin(
  lines: LyricLine[],
  lineIdx: number,
  newBegin: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  if (!line || !isLineSynced(line)) return;
  const mb = mainBounds(line);
  if (!mb) return;

  const duration = mb.end - mb.begin;
  updateLineWithHistory(line.id, { begin: newBegin, end: newBegin + duration }, { propagateToSiblings: false });
}

export { nudgeLineBegin, setLineBegin };
