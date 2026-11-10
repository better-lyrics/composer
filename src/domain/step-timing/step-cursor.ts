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

// With background vocals included, a line's background words come right after its lead words.
function nextSlotWithBackground(
  lines: readonly LyricLine[],
  cursor: WordSelection,
  include: LineFilter,
): WordSelection | null {
  const line = lines[cursor.lineIndex];
  const leadWords = line ? effectiveTrackWords(line, "word") : undefined;
  const leadEnds = cursor.type === "word" && cursor.wordIndex + 1 === leadWords?.length;
  if (line && leadEnds && effectiveTrackWords(line, "bg")?.length) {
    return { lineId: line.id, lineIndex: cursor.lineIndex, wordIndex: 0, type: "bg" };
  }
  return nextStepSlot(lines, cursor, include);
}

function nextCursorSlot(
  lines: readonly LyricLine[],
  cursor: WordSelection,
  queue: readonly WordSelection[] | null,
  include: LineFilter,
  withBackground = false,
): WordSelection | null {
  if (queue) return nextInQueue(queue, cursor);
  return withBackground ? nextSlotWithBackground(lines, cursor, include) : nextStepSlot(lines, cursor, include);
}

// -- Exports ------------------------------------------------------------------

export { nextCursorSlot, nextStepSlot };
