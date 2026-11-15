import type { LyricLine } from "@/domain/line/model";
import { mainTrack } from "@/domain/line/track";
import type { SyncCursor } from "@/domain/sync/cursor";

// -- Types --------------------------------------------------------------------

interface SyncAddress {
  lineId: string | null;
  syllableId: string | null;
  storedAt: SyncCursor;
}

// -- Constants ----------------------------------------------------------------

const SYNC_START: SyncAddress = { lineId: null, syllableId: null, storedAt: { lineIndex: 0, wordIndex: 0 } };

// -- Functions ----------------------------------------------------------------

// Every Sync slot is a syllable of the main track, timed or not, so the cursor names it by id.
function syncAddressAt(lines: readonly LyricLine[], cursor: SyncCursor): SyncAddress {
  const line = lines[cursor.lineIndex];
  if (!line) return { lineId: null, syllableId: null, storedAt: cursor };
  const syllable = mainTrack(line).syllables[cursor.wordIndex];
  return { lineId: line.id, syllableId: syllable?.id ?? null, storedAt: cursor };
}

// A cursor whose line or syllable is gone falls back to where it stood, which the cursor resolver then clamps.
function syncAddressPosition(lines: readonly LyricLine[], address: SyncAddress): SyncCursor {
  if (address.lineId === null) return address.storedAt;
  const lineIndex = lines.findIndex((line) => line.id === address.lineId);
  if (lineIndex === -1) return address.storedAt;
  const syllables = mainTrack(lines[lineIndex]).syllables;
  if (address.syllableId === null) return { lineIndex, wordIndex: syllables.length };
  const wordIndex = syllables.findIndex((syllable) => syllable.id === address.syllableId);
  return wordIndex === -1 ? address.storedAt : { lineIndex, wordIndex };
}

// Addresses match by where they resolve, so a syllable timed in place still matches.
function sameSyncPosition(lines: readonly LyricLine[], a: SyncAddress, b: SyncAddress): boolean {
  const first = syncAddressPosition(lines, a);
  const second = syncAddressPosition(lines, b);
  return first.lineIndex === second.lineIndex && first.wordIndex === second.wordIndex;
}

// -- Exports ------------------------------------------------------------------

export { SYNC_START, sameSyncPosition, syncAddressAt, syncAddressPosition };
export type { SyncAddress };
