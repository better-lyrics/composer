import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import { lastEnd } from "@/domain/word/bounds";

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

function stepStartSlot(lines: readonly LyricLine[], time: number, include: LineFilter): WordSelection | null {
  for (let i = 0; i < lines.length; i++) {
    const words = effectiveTrackWords(lines[i], "word");
    if (include(lines[i]) && words?.length && lastEnd(words) > time) return firstWordOf(lines[i], i);
  }
  return null;
}

// -- Exports ------------------------------------------------------------------

export { nextStepSlot, stepStartSlot };
