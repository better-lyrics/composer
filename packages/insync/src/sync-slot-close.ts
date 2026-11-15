import type { LineUpdate, LyricLine } from "./line";
import { isSpanTimed, mainTrack, timedSyllables } from "./line-track";
import { withMainTrack, withRoleWords, withTrackSpan } from "./line-track-writes";
import { type SyncSlot, slotBounds } from "./sync-cursor";
import type { Bounds } from "./word-bounds";
import type { WordTiming } from "./word-timing";

// -- Types --------------------------------------------------------------------

interface SlotWriteIntent {
  lineIndex: number;
  keepsSetEnds: boolean;
  replacedBegin: number | undefined;
  begin: number;
  open: boolean;
  jumped: boolean;
  defaultWordDuration: number;
}

// -- Helpers ------------------------------------------------------------------

function tapEnd(begin: number, defaultWordDuration: number): number {
  return begin + defaultWordDuration;
}

// An end a person chose (hold release, Timeline edit, import) is set; an open slot, a tap's default end, or an end
// joined to the start being re-recorded is still the gesture's to move.
function isSetEnd(previous: Bounds, intent: SlotWriteIntent): boolean {
  if (previous.begin === previous.end) return false;
  if (previous.end === tapEnd(previous.begin, intent.defaultWordDuration)) return false;
  return previous.end !== intent.replacedBegin;
}

// Forward taps end the previous slot at begin and forward holds close it while open; otherwise only an overlap is trimmed.
function forwardEnd(previous: Bounds, { begin, open, jumped }: SlotWriteIntent): number {
  if (!open && !jumped) return begin;
  if (previous.begin === previous.end && !jumped) return begin;
  return Math.min(previous.end, begin);
}

// -- Functions ----------------------------------------------------------------

// Words in one line never overlap, so a set word is still cut at a tap inside it; across lines a set end stays.
function previousSlotEnd(lines: readonly LyricLine[], slot: SyncSlot | null, intent: SlotWriteIntent): number | null {
  const previous = slot ? slotBounds(lines, slot) : null;
  if (!slot || !previous) return null;
  if (!intent.keepsSetEnds) return forwardEnd(previous, intent);
  if (isSetEnd(previous, intent)) {
    return slot.lineIndex === intent.lineIndex ? Math.min(previous.end, intent.begin) : null;
  }
  if (intent.begin >= previous.begin) return forwardEnd(previous, intent);
  return previous.begin === previous.end ? tapEnd(previous.begin, intent.defaultWordDuration) : null;
}

function closeSlotWords(words: readonly WordTiming[], index: number, end: number): WordTiming[] {
  const next = [...words];
  next[index] = { ...next[index], end: Math.max(end, next[index].begin) };
  return next;
}

function closeSlot(line: LyricLine, slot: SyncSlot, end: number): Partial<LyricLine> | null {
  const main = mainTrack(line);
  const words = timedSyllables(main);
  if (words.length && slot.wordIndex !== null) {
    return { tracks: withRoleWords(line, "main", closeSlotWords(words, slot.wordIndex, end)).tracks };
  }
  if (!isSpanTimed(main)) return null;
  return { tracks: withMainTrack(line, withTrackSpan(main, main.begin, Math.max(end, main.begin))).tracks };
}

function closingUpdate(lines: readonly LyricLine[], slot: SyncSlot | null, end: number | null): LineUpdate | null {
  if (!slot || end === null || slotBounds(lines, slot)?.end === end) return null;
  const line = lines[slot.lineIndex];
  const updates = closeSlot(line, slot, end);
  return updates ? { id: line.id, updates } : null;
}

// -- Exports ------------------------------------------------------------------

export { closeSlotWords, closingUpdate, previousSlotEnd, tapEnd };
