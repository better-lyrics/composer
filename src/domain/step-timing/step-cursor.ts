import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import { nextInQueue } from "@/domain/step-timing/step-queue";

// -- Types --------------------------------------------------------------------

type LineFilter = (line: LyricLine) => boolean;

// -- Helpers ------------------------------------------------------------------

function mainBlocks(line: LyricLine): number {
  return effectiveTrackWords(line, "word")?.length ?? 0;
}

function firstWordOf(line: LyricLine, lineIndex: number): WordSelection {
  return { lineId: line.id, lineIndex, wordIndex: 0, type: "word" };
}

// -- Functions ----------------------------------------------------------------

function nextStepSlot(lines: readonly LyricLine[], cursor: WordSelection, include: LineFilter): WordSelection | null {
  const line = lines[cursor.lineIndex];
  const words = line ? effectiveTrackWords(line, cursor.type) : undefined;
  if (words && cursor.wordIndex + 1 < words.length) return { ...cursor, wordIndex: cursor.wordIndex + 1 };
  for (let i = cursor.lineIndex + 1; i < lines.length; i++) {
    if (include(lines[i]) && mainBlocks(lines[i]) > 0) return firstWordOf(lines[i], i);
  }
  return null;
}

function nextCursorSlot(
  lines: readonly LyricLine[],
  cursor: WordSelection,
  queue: readonly WordSelection[] | null,
  include: LineFilter,
): WordSelection | null {
  return queue ? nextInQueue(queue, cursor) : nextStepSlot(lines, cursor, include);
}

// -- Exports ------------------------------------------------------------------

export { nextCursorSlot, nextStepSlot };
