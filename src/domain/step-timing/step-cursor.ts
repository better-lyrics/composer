import { drawnSyllables } from "@/domain/line/drawn-track";
import type { LyricLine } from "insync/line";
import type { SyllableAddress } from "insync/selection-model";
import { type ResolvedAddress, resolveAddress, resolvedAt } from "@/domain/selection/resolve";
import { nextInQueue } from "@/domain/step-timing/step-queue";

// -- Types --------------------------------------------------------------------

type LineFilter = (line: LyricLine) => boolean;

// -- Helpers ------------------------------------------------------------------

function mainBlocks(line: LyricLine, splitChar: string): number {
  return drawnSyllables(line, "main", splitChar).length;
}

// -- Functions ----------------------------------------------------------------

function nextStepSlot(
  lines: readonly LyricLine[],
  cursor: ResolvedAddress,
  include: LineFilter,
  splitChar: string,
): ResolvedAddress | null {
  const sameTrack = resolvedAt(lines, cursor.lineIndex, cursor.type, cursor.wordIndex + 1, splitChar);
  if (sameTrack) return sameTrack;
  for (let i = cursor.lineIndex + 1; i < lines.length; i++) {
    if (include(lines[i]) && mainBlocks(lines[i], splitChar) > 0) return resolvedAt(lines, i, "word", 0, splitChar);
  }
  return null;
}

// With background vocals included, a line's background words come right after its lead words.
function nextSlotWithBackground(
  lines: readonly LyricLine[],
  cursor: ResolvedAddress,
  include: LineFilter,
  splitChar: string,
): ResolvedAddress | null {
  const line = lines[cursor.lineIndex];
  const leadWords = line ? drawnSyllables(line, "main", splitChar) : undefined;
  const leadEnds = cursor.type === "word" && cursor.wordIndex + 1 === leadWords?.length;
  const firstBackground = leadEnds ? resolvedAt(lines, cursor.lineIndex, "bg", 0, splitChar) : null;
  return firstBackground ?? nextStepSlot(lines, cursor, include, splitChar);
}

function nextCursorSlot(
  lines: readonly LyricLine[],
  cursor: ResolvedAddress,
  queue: readonly SyllableAddress[] | null,
  include: LineFilter,
  splitChar: string,
  withBackground = false,
): ResolvedAddress | null {
  if (queue) {
    const next = nextInQueue(queue, cursor);
    return next && resolveAddress(lines, next, splitChar);
  }
  return withBackground
    ? nextSlotWithBackground(lines, cursor, include, splitChar)
    : nextStepSlot(lines, cursor, include, splitChar);
}

// -- Exports ------------------------------------------------------------------

export { nextCursorSlot, nextStepSlot };
