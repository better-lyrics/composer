import { mainBounds } from "@/domain/line/bounds";
import { type LineUpdate, type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { shiftLineTiming, shiftWords } from "@/domain/line/shift";
import { isSyncableLine } from "@/domain/line/sync-progress";
import { advanceCursor, previousSlot, type SyncCursor, type SyncSlot, slotBounds } from "@/domain/sync/cursor";
import { enforceOrderAround } from "@/domain/word/order";
import type { WordTiming } from "@/domain/word/timing";
import { createInitialBgWords, splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// -- Types --------------------------------------------------------------------

type SyncGesture = "tap-word" | "tap-line" | "hold-start" | "hold-end" | "hold-tap";

interface GestureContext {
  cursor: SyncCursor;
  jumped: boolean;
  time: number;
  defaultWordDuration: number;
}

interface GestureCommit {
  lineUpdates: LineUpdate[];
  nextCursor: SyncCursor;
  nextJumped: boolean;
  clampedTo: number | null;
}

interface SlotWrite {
  update: LineUpdate;
  clampedTo: number | null;
  closes: LineUpdate | null;
}

// -- Floor ----------------------------------------------------------------

interface Anchor {
  slot: SyncSlot | null;
  floor: number;
}

function closableSlot(lines: readonly LyricLine[], slot: SyncSlot): SyncSlot {
  const words = lines[slot.lineIndex]?.words;
  return slot.wordIndex === null && words?.length ? { lineIndex: slot.lineIndex, wordIndex: words.length - 1 } : slot;
}

// A forward pass may shrink the slot it closes down to its begin; after a jump the previous slot stays whole.
function anchorBefore(lines: readonly LyricLine[], ctx: GestureContext, granularity: "line" | "word"): Anchor {
  const previous = previousSlot(lines, ctx.cursor, granularity);
  if (!previous) return { slot: null, floor: 0 };
  const slot = ctx.jumped ? previous : closableSlot(lines, previous);
  const bounds = slotBounds(lines, slot);
  if (!bounds) return { slot: null, floor: 0 };
  return { slot, floor: ctx.jumped ? bounds.end : bounds.begin };
}

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

function closingUpdate(lines: readonly LyricLine[], slot: SyncSlot | null, end: number): LineUpdate | null {
  if (!slot) return null;
  const line = lines[slot.lineIndex];
  const updates = closeSlot(line, slot, end);
  return updates ? { id: line.id, updates } : null;
}

// -- Background -----------------------------------------------------------------

function backgroundFor(line: LyricLine, begin: number): { backgroundWords?: WordTiming[] } {
  const oldMain = mainBounds(line);
  if (line.backgroundWords?.length) {
    return oldMain ? { backgroundWords: shiftWords(line.backgroundWords, begin - oldMain.begin) } : {};
  }
  if (!oldMain && line.backgroundText) return { backgroundWords: createInitialBgWords(line.backgroundText, begin) };
  return {};
}

// -- Word slot writing ----------------------------------------------------------

function slotText(line: LyricLine, wordIndex: number): string | null {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(line.text);
  const text = parts[wordIndex];
  if (!text) return null;
  return trailingSpace[wordIndex] ? `${text} ` : text;
}

function writeWord(lines: readonly LyricLine[], ctx: GestureContext, open: boolean): SlotWrite | null {
  const { cursor } = ctx;
  const line = lines[cursor.lineIndex];
  if (!isSyncableLine(line)) return null;
  const text = slotText(line, cursor.wordIndex);
  const existing = line.words ?? [];
  if (text === null || cursor.wordIndex > existing.length) return null;

  const { slot, floor } = anchorBefore(lines, ctx, "word");
  const begin = Math.max(ctx.time, floor);
  const nextWord = existing[cursor.wordIndex + 1];
  const provisional = open ? begin : begin + ctx.defaultWordDuration;
  const end = nextWord && nextWord.begin >= begin ? Math.min(provisional, nextWord.begin) : provisional;

  let words = [...existing];
  words[cursor.wordIndex] = { ...existing[cursor.wordIndex], text, begin, end };

  const closingSlot = ctx.jumped ? null : slot;
  const sameLine = closingSlot && closingSlot.lineIndex === cursor.lineIndex ? closingSlot : null;
  if (sameLine && sameLine.wordIndex !== null) words = closeSlotWords(words, sameLine.wordIndex, begin);
  words = enforceOrderAround(words, cursor.wordIndex);

  const background = cursor.wordIndex === 0 ? backgroundFor(line, begin) : {};
  const crossLine = closingSlot && closingSlot.lineIndex !== cursor.lineIndex ? closingSlot : null;

  return {
    update: { id: line.id, updates: { words, ...background } },
    clampedTo: ctx.time < floor ? floor : null,
    closes: closingUpdate(lines, crossLine, begin),
  };
}

// -- Line slot writing ------------------------------------------------------------

function writeLine(lines: readonly LyricLine[], ctx: GestureContext): SlotWrite | null {
  const { cursor } = ctx;
  const line = lines[cursor.lineIndex];
  if (!isSyncableLine(line)) return null;

  const { slot, floor } = anchorBefore(lines, ctx, "line");
  const begin = Math.max(ctx.time, floor);
  const oldMain = mainBounds(line);
  const updates: Partial<LyricLine> = oldMain
    ? shiftLineTiming(line, begin - oldMain.begin)
    : { begin, end: begin, ...backgroundFor(line, begin) };

  return {
    update: { id: line.id, updates },
    clampedTo: ctx.time < floor ? floor : null,
    closes: closingUpdate(lines, ctx.jumped ? null : slot, begin),
  };
}

// -- Hold close -------------------------------------------------------------------

interface ClosedHold {
  update: LineUpdate;
  clampedTo: number | null;
  closeEnd: number;
}

function closeHeld(lines: readonly LyricLine[], cursor: SyncCursor, time: number): ClosedHold | null {
  const line = lines[cursor.lineIndex];
  if (!line) return null;
  const held = line.words?.[cursor.wordIndex];
  if (!held || held.begin !== held.end) return null;

  const words = enforceOrderAround(closeSlotWords(line.words ?? [], cursor.wordIndex, time), cursor.wordIndex);
  return {
    update: { id: line.id, updates: { words } },
    clampedTo: time < held.begin ? held.begin : null,
    closeEnd: Math.max(time, held.begin),
  };
}

// -- Merge and apply ---------------------------------------------------------------

// Narrows like reconcileLine, so one merged update lands the same as the two applied in order.
function mergeLineUpdate(first: Partial<LyricLine>, second: Partial<LyricLine>): Partial<LyricLine> {
  const merged: Partial<LooseLine> = { ...first, ...second };
  const { words, begin, end, ...rest } = merged;
  if (words !== undefined) return { ...rest, words };
  return {
    ...rest,
    ...("words" in merged ? { words } : {}),
    ...("begin" in merged ? { begin } : {}),
    ...("end" in merged ? { end } : {}),
  };
}

function mergeUpdates(a: readonly LineUpdate[], b: readonly LineUpdate[]): LineUpdate[] {
  const merged = new Map(a.map((u) => [u.id, u.updates]));
  for (const u of b) {
    const earlier = merged.get(u.id);
    merged.set(u.id, earlier ? mergeLineUpdate(earlier, u.updates) : u.updates);
  }
  return [...merged].map(([id, updates]) => ({ id, updates }));
}

function applyUpdates(lines: readonly LyricLine[], updates: readonly LineUpdate[]): LyricLine[] {
  const byId = new Map(updates.map((u) => [u.id, u.updates]));
  return lines.map((line) => {
    const update = byId.get(line.id);
    return update ? reconcileLine({ ...line, ...update }) : line;
  });
}

function slotWriteToUpdates(write: SlotWrite): LineUpdate[] {
  return write.closes ? [write.update, write.closes] : [write.update];
}

// -- Dispatcher -------------------------------------------------------------------

function commitGesture(lines: readonly LyricLine[], gesture: SyncGesture, ctx: GestureContext): GestureCommit | null {
  if (gesture === "tap-word" || gesture === "hold-start") {
    const open = gesture === "hold-start";
    const write = writeWord(lines, ctx, open);
    if (!write) return null;
    return {
      lineUpdates: slotWriteToUpdates(write),
      nextCursor: open ? ctx.cursor : advanceCursor(lines, ctx.cursor, "word"),
      nextJumped: open ? ctx.jumped : false,
      clampedTo: write.clampedTo,
    };
  }

  if (gesture === "tap-line") {
    const write = writeLine(lines, ctx);
    if (!write) return null;
    return {
      lineUpdates: slotWriteToUpdates(write),
      nextCursor: advanceCursor(lines, ctx.cursor, "line"),
      nextJumped: false,
      clampedTo: write.clampedTo,
    };
  }

  const closed = closeHeld(lines, ctx.cursor, ctx.time);
  if (!closed) return null;
  const nextCursor = advanceCursor(lines, ctx.cursor, "word");

  if (gesture === "hold-end") {
    return { lineUpdates: [closed.update], nextCursor, nextJumped: false, clampedTo: closed.clampedTo };
  }

  const linesAfterClose = applyUpdates(lines, [closed.update]);
  const opened = writeWord(linesAfterClose, { ...ctx, cursor: nextCursor, jumped: true, time: closed.closeEnd }, true);
  const lineUpdates = opened ? mergeUpdates([closed.update], [opened.update]) : [closed.update];
  return { lineUpdates, nextCursor, nextJumped: false, clampedTo: closed.clampedTo };
}

// -- Exports ------------------------------------------------------------------

export { commitGesture };
export type { GestureCommit, SyncGesture };
