import { drawnSyllables } from "@/domain/line/drawn-track";
import type { LyricLine } from "@/domain/line/model";
import type { SyllableAddress } from "@/domain/selection/model";
import { type ResolvedAddress, resolveAddress, resolvedAt } from "@/domain/selection/resolve";
import { nextInQueue } from "@/domain/step-timing/step-queue";

// -- Types --------------------------------------------------------------------

type LineFilter = (line: LyricLine) => boolean;

// -- Helpers ------------------------------------------------------------------

function mainBlocks(line: LyricLine): number {
  return drawnSyllables(line, "main").length;
}

// -- Functions ----------------------------------------------------------------

function nextStepSlot(
  lines: readonly LyricLine[],
  cursor: ResolvedAddress,
  include: LineFilter,
): ResolvedAddress | null {
  const sameTrack = resolvedAt(lines, cursor.lineIndex, cursor.type, cursor.wordIndex + 1);
  if (sameTrack) return sameTrack;
  for (let i = cursor.lineIndex + 1; i < lines.length; i++) {
    if (include(lines[i]) && mainBlocks(lines[i]) > 0) return resolvedAt(lines, i, "word", 0);
  }
  return null;
}

// With background vocals included, a line's background words come right after its lead words.
function nextSlotWithBackground(
  lines: readonly LyricLine[],
  cursor: ResolvedAddress,
  include: LineFilter,
): ResolvedAddress | null {
  const line = lines[cursor.lineIndex];
  const leadWords = line ? drawnSyllables(line, "main") : undefined;
  const leadEnds = cursor.type === "word" && cursor.wordIndex + 1 === leadWords?.length;
  const firstBackground = leadEnds ? resolvedAt(lines, cursor.lineIndex, "bg", 0) : null;
  return firstBackground ?? nextStepSlot(lines, cursor, include);
}

function nextCursorSlot(
  lines: readonly LyricLine[],
  cursor: ResolvedAddress,
  queue: readonly SyllableAddress[] | null,
  include: LineFilter,
  withBackground = false,
): ResolvedAddress | null {
  if (queue) {
    const next = nextInQueue(queue, cursor);
    return next && resolveAddress(lines, next);
  }
  return withBackground ? nextSlotWithBackground(lines, cursor, include) : nextStepSlot(lines, cursor, include);
}

// -- Exports ------------------------------------------------------------------

export { nextCursorSlot, nextStepSlot };
