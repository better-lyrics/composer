import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { type SyncSlot, slotBounds } from "@/domain/sync/cursor";
import type { WordTiming } from "@/domain/word/timing";

// -- Functions ----------------------------------------------------------------

function closeSlotWords(words: readonly WordTiming[], index: number, end: number): WordTiming[] {
  const next = [...words];
  next[index] = { ...next[index], end: Math.max(end, next[index].begin) };
  return next;
}

function closeSlot(line: LyricLine, slot: SyncSlot, end: number): Partial<LyricLine> | null {
  if (line.words?.length && slot.wordIndex !== null) return { words: closeSlotWords(line.words, slot.wordIndex, end) };
  if (isLineSynced(line)) return { end: Math.max(end, line.begin) };
  return null;
}

// Forward taps end the previous slot at begin and forward holds close it while open; otherwise only an overlap is trimmed.
function closingTime(
  lines: readonly LyricLine[],
  slot: SyncSlot | null,
  begin: number,
  { open, jumped }: { open: boolean; jumped: boolean },
): number {
  if (!open && !jumped) return begin;
  const previous = slot ? slotBounds(lines, slot) : null;
  if (!previous || (previous.begin === previous.end && !jumped)) return begin;
  return Math.min(previous.end, begin);
}

// A line that starts before the previous line's last word overlaps it; a word still held open gets the default length.
function overlapEnd(
  lines: readonly LyricLine[],
  slot: SyncSlot | null,
  begin: number,
  defaultWordDuration: number,
): number | null {
  const previous = slot ? slotBounds(lines, slot) : null;
  if (!previous || begin >= previous.begin) return null;
  return previous.begin === previous.end ? previous.begin + defaultWordDuration : previous.end;
}

function closingUpdate(lines: readonly LyricLine[], slot: SyncSlot | null, end: number): LineUpdate | null {
  if (!slot || slotBounds(lines, slot)?.end === end) return null;
  const line = lines[slot.lineIndex];
  const updates = closeSlot(line, slot, end);
  return updates ? { id: line.id, updates } : null;
}

// -- Exports ------------------------------------------------------------------

export { closeSlotWords, closingTime, closingUpdate, overlapEnd };
