import type { LyricLine } from "@/stores/project";

type UpdateLineWithHistory = (id: string, updates: Partial<LyricLine>) => void;

function nudgeLineBegin(
  lines: LyricLine[],
  lineIdx: number,
  delta: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  if (line?.begin === undefined) return;

  const newBegin = Math.max(0, line.begin + delta);
  const duration = (line.end ?? line.begin) - line.begin;
  updateLineWithHistory(line.id, {
    begin: newBegin,
    end: newBegin + duration,
  });
}

function setLineBegin(
  lines: LyricLine[],
  lineIdx: number,
  newBegin: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  if (line?.begin === undefined) return;

  const duration = (line.end ?? line.begin) - line.begin;
  updateLineWithHistory(line.id, {
    begin: newBegin,
    end: newBegin + duration,
  });
}

export { nudgeLineBegin, setLineBegin };
