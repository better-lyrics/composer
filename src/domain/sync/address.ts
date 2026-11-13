import type { LyricLine } from "@/domain/line/model";
import type { SyncCursor } from "@/domain/sync/cursor";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// -- Types --------------------------------------------------------------------

// Untimed slots exist only in the line text, so a cursor on one names its whitespace word and the syllable inside it:
// splits, timing given by another action and edits after it leave both unchanged.
type SyncSlotAddress = { syllableId: string } | { textWord: number; syllable: number };

interface SyncAddress {
  lineId: string | null;
  at: SyncSlotAddress;
  storedAt: SyncCursor;
}

// -- Constants ----------------------------------------------------------------

const SYNC_START: SyncAddress = {
  lineId: null,
  at: { textWord: 0, syllable: 0 },
  storedAt: { lineIndex: 0, wordIndex: 0 },
};

// -- Functions ----------------------------------------------------------------

function textSlotAt(text: string, slotIndex: number): { textWord: number; syllable: number } {
  const { trailingSpace } = splitIntoWordsWithMeta(text);
  let textWord = 0;
  let wordStart = 0;
  for (let i = 0; i < Math.min(slotIndex, trailingSpace.length); i++) {
    if (!trailingSpace[i]) continue;
    textWord++;
    wordStart = i + 1;
  }
  return slotIndex < trailingSpace.length
    ? { textWord, syllable: slotIndex - wordStart }
    : { textWord: textWord + 1, syllable: 0 };
}

// A word or syllable that no longer exists resolves to the end of the line or of its word.
function textSlotIndex(text: string, slot: { textWord: number; syllable: number }): number {
  const { trailingSpace } = splitIntoWordsWithMeta(text);
  let textWord = 0;
  for (let i = 0; i < trailingSpace.length; i++) {
    if (textWord === slot.textWord) {
      let wordEnd = i;
      while (wordEnd < trailingSpace.length - 1 && !trailingSpace[wordEnd]) wordEnd++;
      return Math.min(i + slot.syllable, wordEnd);
    }
    if (trailingSpace[i]) textWord++;
  }
  return trailingSpace.length;
}

function syncAddressAt(lines: readonly LyricLine[], cursor: SyncCursor): SyncAddress {
  const line = lines[cursor.lineIndex];
  if (!line) return { lineId: null, at: { textWord: 0, syllable: 0 }, storedAt: cursor };
  const word = line.words?.[cursor.wordIndex];
  const at = word ? { syllableId: word.id } : textSlotAt(line.text, cursor.wordIndex);
  return { lineId: line.id, at, storedAt: cursor };
}

// A cursor whose line or word is gone falls back to where it stood, which the cursor resolver then clamps.
function syncAddressPosition(lines: readonly LyricLine[], address: SyncAddress): SyncCursor {
  if (address.lineId === null) return address.storedAt;
  const lineIndex = lines.findIndex((line) => line.id === address.lineId);
  if (lineIndex === -1) return address.storedAt;
  const line = lines[lineIndex];
  const { at } = address;
  if ("textWord" in at) return { lineIndex, wordIndex: textSlotIndex(line.text, at) };
  const wordIndex = (line.words ?? []).findIndex((word) => word.id === at.syllableId);
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
