import type { LyricLine } from "@/domain/line/model";
import type { SyncCursor } from "@/domain/sync/cursor";

// -- Types --------------------------------------------------------------------

// Untimed words exist only in the line text, so a cursor on one counts into the untimed tail instead of naming it.
type SyncSlotAddress = { syllableId: string } | { untimed: number };

interface SyncAddress {
  lineId: string | null;
  at: SyncSlotAddress;
  storedAt: SyncCursor;
}

// -- Constants ----------------------------------------------------------------

const SYNC_START: SyncAddress = { lineId: null, at: { untimed: 0 }, storedAt: { lineIndex: 0, wordIndex: 0 } };

// -- Functions ----------------------------------------------------------------

function syncAddressAt(lines: readonly LyricLine[], cursor: SyncCursor): SyncAddress {
  const line = lines[cursor.lineIndex];
  if (!line) return { lineId: null, at: { untimed: 0 }, storedAt: cursor };
  const words = line.words ?? [];
  const word = words[cursor.wordIndex];
  const at = word ? { syllableId: word.id } : { untimed: cursor.wordIndex - words.length };
  return { lineId: line.id, at, storedAt: cursor };
}

// A cursor whose line or word is gone falls back to where it stood, which the cursor resolver then clamps.
function syncAddressPosition(lines: readonly LyricLine[], address: SyncAddress): SyncCursor {
  if (address.lineId === null) return address.storedAt;
  const lineIndex = lines.findIndex((line) => line.id === address.lineId);
  if (lineIndex === -1) return address.storedAt;
  const words = lines[lineIndex].words ?? [];
  const { at } = address;
  if ("untimed" in at) return { lineIndex, wordIndex: words.length + at.untimed };
  const wordIndex = words.findIndex((word) => word.id === at.syllableId);
  return wordIndex === -1 ? address.storedAt : { lineIndex, wordIndex };
}

// Addresses match by where they resolve, so an untimed slot that became a timed word in place still matches.
function sameSyncPosition(lines: readonly LyricLine[], a: SyncAddress, b: SyncAddress): boolean {
  const first = syncAddressPosition(lines, a);
  const second = syncAddressPosition(lines, b);
  return first.lineIndex === second.lineIndex && first.wordIndex === second.wordIndex;
}

// -- Exports ------------------------------------------------------------------

export { SYNC_START, sameSyncPosition, syncAddressAt, syncAddressPosition };
export type { SyncAddress };
