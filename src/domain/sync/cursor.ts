import { mainBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { isSyncableLine, type SyncGranularity } from "@/domain/line/sync-progress";
import { splitIntoWords } from "@/utils/sync-helpers";

// -- Types --------------------------------------------------------------------

interface SyncCursor {
  lineIndex: number;
  wordIndex: number;
}

interface SyncSlot {
  lineIndex: number;
  wordIndex: number | null;
}

// -- Navigation ---------------------------------------------------------------

function nextSyncableLineIndex(lines: readonly LyricLine[], fromIndex: number): number {
  for (let i = fromIndex + 1; i < lines.length; i++) if (isSyncableLine(lines[i])) return i;
  return lines.length;
}

function prevSyncableLineIndex(lines: readonly LyricLine[], fromIndex: number): number {
  for (let i = Math.min(fromIndex, lines.length) - 1; i >= 0; i--) if (isSyncableLine(lines[i])) return i;
  return -1;
}

function advanceCursor(lines: readonly LyricLine[], cursor: SyncCursor, granularity: SyncGranularity): SyncCursor {
  const line = lines[cursor.lineIndex];
  if (granularity === "word" && line && cursor.wordIndex + 1 < splitIntoWords(line.text).length) {
    return { lineIndex: cursor.lineIndex, wordIndex: cursor.wordIndex + 1 };
  }
  return { lineIndex: nextSyncableLineIndex(lines, cursor.lineIndex), wordIndex: 0 };
}

function isCursorPastEnd(lines: readonly LyricLine[], cursor: SyncCursor): boolean {
  return lines.length > 0 && cursor.lineIndex >= lines.length;
}

// -- Resolution ---------------------------------------------------------------

function firstUntimedSlot(line: LyricLine, granularity: SyncGranularity): number | null {
  if (isLineSynced(line)) return null;
  const timed = line.words?.length ?? 0;
  if (granularity === "line") return timed > 0 ? null : 0;
  return timed < splitIntoWords(line.text).length ? timed : null;
}

function clampCursor(lines: readonly LyricLine[], stored: SyncCursor, granularity: SyncGranularity): SyncCursor {
  const lineIndex = Math.max(0, Math.min(stored.lineIndex, lines.length));
  if (lineIndex < lines.length && !isSyncableLine(lines[lineIndex])) {
    return { lineIndex: nextSyncableLineIndex(lines, lineIndex), wordIndex: 0 };
  }
  const line = lines[lineIndex];
  if (!line || granularity === "line") return { lineIndex, wordIndex: 0 };
  return { lineIndex, wordIndex: Math.max(0, Math.min(stored.wordIndex, line.words?.length ?? 0)) };
}

// Undo can remove timing behind the stored cursor; pull it back so the next tap fills the hole.
function resolveSyncCursor(
  lines: readonly LyricLine[],
  stored: SyncCursor,
  jumped: boolean,
  granularity: SyncGranularity,
): SyncCursor {
  let cursor = clampCursor(lines, stored, granularity);
  if (jumped) return cursor;
  while (cursor.wordIndex === 0) {
    const prev = prevSyncableLineIndex(lines, cursor.lineIndex);
    if (prev < 0) break;
    const gap = firstUntimedSlot(lines[prev], granularity);
    if (gap === null) break;
    cursor = { lineIndex: prev, wordIndex: gap };
  }
  return cursor;
}

// -- Slots --------------------------------------------------------------------

function lastSlotOf(lines: readonly LyricLine[], lineIndex: number, granularity: SyncGranularity): SyncSlot | null {
  const line = lines[lineIndex];
  if (granularity === "word" && line.words?.length) return { lineIndex, wordIndex: line.words.length - 1 };
  return mainBounds(line) ? { lineIndex, wordIndex: null } : null;
}

function previousSlot(lines: readonly LyricLine[], cursor: SyncCursor, granularity: SyncGranularity): SyncSlot | null {
  const words = lines[cursor.lineIndex]?.words;
  if (granularity === "word" && words?.length && cursor.wordIndex > 0) {
    return { lineIndex: cursor.lineIndex, wordIndex: Math.min(cursor.wordIndex, words.length) - 1 };
  }
  const prev = prevSyncableLineIndex(lines, cursor.lineIndex);
  return prev < 0 ? null : lastSlotOf(lines, prev, granularity);
}

function slotBounds(lines: readonly LyricLine[], slot: SyncSlot): { begin: number; end: number } | null {
  const line = lines[slot.lineIndex];
  if (!line) return null;
  if (slot.wordIndex === null) {
    const bounds = mainBounds(line);
    return bounds ? { begin: bounds.begin, end: bounds.end } : null;
  }
  const word = line.words?.[slot.wordIndex];
  return word ? { begin: word.begin, end: word.end } : null;
}

// -- Exports ------------------------------------------------------------------

export {
  advanceCursor,
  isCursorPastEnd,
  nextSyncableLineIndex,
  previousSlot,
  prevSyncableLineIndex,
  resolveSyncCursor,
  slotBounds,
};
export type { SyncCursor, SyncSlot };
