import type { LineUpdate, LyricLine } from "./line";
import { mainTrack, timedSyllables } from "./line-track";
import { withRoleWords } from "./line-track-writes";
import { type SyncCursor, previousSlot, slotBounds } from "./sync-cursor";
import { closeSlotWords, closingUpdate, tapEnd } from "./sync-slot-close";
import { enforceOrderAround } from "./word-order";

// -- Types --------------------------------------------------------------------

interface HoldRelease {
  cursor: SyncCursor;
  time: number;
  defaultWordDuration: number;
  // The latest time the held line may reach: the song end, or its shared range.
  rangeEnd: number;
}

interface ClosedHold {
  update: LineUpdate;
  clampedTo: number | null;
  closeEnd: number;
}

// -- Functions ----------------------------------------------------------------

function closeHeld(
  lines: readonly LyricLine[],
  { cursor, time, defaultWordDuration, rangeEnd }: HoldRelease,
): ClosedHold | null {
  const line = lines[cursor.lineIndex];
  if (!line) return null;
  const timed = timedSyllables(mainTrack(line));
  const held = timed[cursor.wordIndex];
  if (!held || held.begin !== held.end) return null;

  const closeEnd = Math.min(time > held.begin ? time : tapEnd(held.begin, defaultWordDuration), rangeEnd);
  const words = enforceOrderAround(closeSlotWords(timed, cursor.wordIndex, closeEnd), cursor.wordIndex, rangeEnd);
  return {
    update: { id: line.id, updates: { tracks: withRoleWords(line, "main", words).tracks } },
    clampedTo: time < held.begin ? held.begin : null,
    closeEnd,
  };
}

// In Line mode a hold opens a whole line, so its release ends that line while it is still open.
function closeHeldLine(lines: readonly LyricLine[], release: HoldRelease, splitChar: string): ClosedHold | null {
  const slot = previousSlot(lines, release.cursor, "line", splitChar);
  const held = slot && slotBounds(lines, slot);
  if (!slot || !held || held.begin !== held.end) return null;
  const { time, defaultWordDuration, rangeEnd } = release;
  const closeEnd = Math.min(time > held.begin ? time : tapEnd(held.begin, defaultWordDuration), rangeEnd);
  const update = closingUpdate(lines, slot, closeEnd);
  return update && { update, clampedTo: time < held.begin ? held.begin : null, closeEnd };
}

// -- Exports ------------------------------------------------------------------

export { closeHeld, closeHeldLine };
