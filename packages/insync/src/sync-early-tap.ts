import type { LyricLine } from "./line";
import type { SyncGranularity } from "./line-sync-progress";
import { mainTrack, timedSyllables } from "./line-track";
import { type SyncCursor, type SyncSlot, previousSlot, slotBounds } from "./sync-cursor";
import type { Bounds } from "./word-bounds";

// -- Types --------------------------------------------------------------------

interface EarlyTapContext {
  cursor: SyncCursor;
  time: number;
  splitChar: string;
}

interface Anchor {
  slot: SyncSlot | null;
  floor: number;
  early: boolean;
  previous: Bounds | null;
}

// -- Constants ----------------------------------------------------------------

const NO_ANCHOR: Anchor = { slot: null, floor: 0, early: false, previous: null };

// -- Functions ----------------------------------------------------------------

function closableSlot(lines: readonly LyricLine[], slot: SyncSlot): SyncSlot {
  const line = lines[slot.lineIndex];
  const words = line ? timedSyllables(mainTrack(line)) : [];
  return slot.wordIndex === null && words.length ? { lineIndex: slot.lineIndex, wordIndex: words.length - 1 } : slot;
}

// A tap may start inside the previous slot; one that lands at or before that slot begins is early and snaps to its end.
function anchorBefore(lines: readonly LyricLine[], ctx: EarlyTapContext, granularity: SyncGranularity): Anchor {
  const previous = previousSlot(lines, ctx.cursor, granularity, ctx.splitChar);
  if (!previous) return NO_ANCHOR;
  const slot = closableSlot(lines, previous);
  const bounds = slotBounds(lines, slot);
  if (!bounds) return NO_ANCHOR;
  const early = ctx.time <= bounds.begin;
  return { slot, floor: early ? bounds.end : bounds.begin, early, previous: bounds };
}

function earlyWithoutRoom(anchor: Anchor, nextBegin: number | undefined): boolean {
  if (!anchor.early || !anchor.previous) return false;
  return anchor.previous.end <= anchor.previous.begin || (nextBegin !== undefined && nextBegin <= anchor.floor);
}

// -- Exports ------------------------------------------------------------------

export { anchorBefore, earlyWithoutRoom };
