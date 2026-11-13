import { type TimeRange, timeRangeResolver } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import { mainBounds } from "@/domain/line/bounds";
import { withBackgroundSeededFrom, withSeededBackground } from "@/domain/line/background";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { clampShiftDelta, shiftLineTiming, shiftWords } from "@/domain/line/shift";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables } from "@/domain/line/track";
import { withMainTrack, withRoleWords, withTrackSpan } from "@/domain/line/track-writes";
import { isSyncableLine } from "@/domain/line/sync-progress";
import { type SyncCursor, type SyncSlot, advanceCursor, previousSlot, slotBounds } from "@/domain/sync/cursor";
import { type SkippedInstance, skippedSharedInstances } from "@/domain/sync/skipped-instances";
import { withSlotWord } from "@/domain/sync/slot-words";
import type { Bounds } from "@/domain/word/bounds";
import { enforceOrderAround } from "@/domain/word/order";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type SyncGesture = "tap-word" | "tap-line" | "hold-start" | "hold-end" | "hold-tap";

interface GestureContext {
  cursor: SyncCursor;
  jumped: boolean;
  time: number;
  defaultWordDuration: number;
  groups?: readonly LinkGroup[];
  skippedInstances?: readonly SkippedInstance[];
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
  const line = lines[slot.lineIndex];
  const words = line ? timedSyllables(mainTrack(line)) : [];
  return slot.wordIndex === null && words.length ? { lineIndex: slot.lineIndex, wordIndex: words.length - 1 } : slot;
}

// A re-record may start inside the previous slot; one that lands before that slot begins is early and snaps to its end.
function anchorBefore(lines: readonly LyricLine[], ctx: GestureContext, granularity: "line" | "word"): Anchor {
  const previous = previousSlot(lines, ctx.cursor, granularity);
  if (!previous) return { slot: null, floor: 0 };
  const slot = closableSlot(lines, previous);
  const bounds = slotBounds(lines, slot);
  if (!bounds) return { slot: null, floor: 0 };
  return { slot, floor: ctx.jumped && ctx.time <= bounds.begin ? bounds.end : bounds.begin };
}

// A placed shared instance keeps the shared end of its last word, even when an undo lost the jump past it.
function followsSkippedInstance(
  lines: readonly LyricLine[],
  ctx: GestureContext,
  granularity: "line" | "word",
): boolean {
  const previous = previousSlot(lines, ctx.cursor, granularity);
  if (!previous || !ctx.groups?.some((group) => group.sharesTiming)) return false;
  const previousId = lines[previous.lineIndex].id;
  const skippedInstances = ctx.skippedInstances ?? skippedSharedInstances(lines, ctx.groups);
  return skippedInstances.some((skipped) => skipped.lineIds.includes(previousId));
}

function withJumpPastSkipped(lines: readonly LyricLine[], ctx: GestureContext, granularity: "line" | "word") {
  return ctx.jumped || !followsSkippedInstance(lines, ctx, granularity) ? ctx : { ...ctx, jumped: true };
}

function rangeOfLine(lines: readonly LyricLine[], line: LyricLine, ctx: GestureContext): TimeRange {
  return timeRangeResolver(lines, ctx.groups ?? [], Number.POSITIVE_INFINITY)(line);
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

function closingUpdate(lines: readonly LyricLine[], slot: SyncSlot | null, end: number): LineUpdate | null {
  if (!slot || slotBounds(lines, slot)?.end === end) return null;
  const line = lines[slot.lineIndex];
  const updates = closeSlot(line, slot, end);
  return updates ? { id: line.id, updates } : null;
}

// -- Background -----------------------------------------------------------------

function withBackgroundFrom(line: LyricLine, begin: number, oldMain: Bounds | null): LyricLine {
  const words = timedSyllables(backgroundTrack(line));
  if (words.length) return oldMain ? withRoleWords(line, "bg", shiftWords(words, begin - oldMain.begin)) : line;
  return withBackgroundSeededFrom(line, begin);
}

// -- Word slot writing ----------------------------------------------------------

function writeWord(lines: readonly LyricLine[], gestureCtx: GestureContext, open: boolean): SlotWrite | null {
  const ctx = withJumpPastSkipped(lines, gestureCtx, "word");
  const { cursor } = ctx;
  const line = lines[cursor.lineIndex];
  if (!isSyncableLine(line)) return null;
  const slots = mainTrack(line).syllables;
  const existing = timedSyllables(mainTrack(line));
  if (!slots[cursor.wordIndex]?.text || cursor.wordIndex > existing.length) return null;

  const anchor = anchorBefore(lines, ctx, "word");
  const { slot } = anchor;
  const floor = Math.max(anchor.floor, rangeOfLine(lines, line, ctx).min);
  const begin = Math.max(ctx.time, floor);
  const nextWord = existing[cursor.wordIndex + 1];
  const provisional = open ? begin : begin + ctx.defaultWordDuration;
  const end = nextWord && nextWord.begin >= begin ? Math.min(provisional, nextWord.begin) : provisional;

  let words = withSlotWord(existing, slots, cursor.wordIndex, { begin, end });

  const closeAt = closingTime(lines, slot, begin, { open, jumped: ctx.jumped });
  const sameLine = slot && slot.lineIndex === cursor.lineIndex ? slot : null;
  if (sameLine && sameLine.wordIndex !== null) words = closeSlotWords(words, sameLine.wordIndex, closeAt);
  words = enforceOrderAround(words, cursor.wordIndex);

  const timed = withRoleWords(line, "main", words);
  const written = cursor.wordIndex === 0 ? withBackgroundFrom(timed, begin, mainBounds(line)) : timed;
  const crossLine = slot && slot.lineIndex !== cursor.lineIndex ? slot : null;

  return {
    update: { id: line.id, updates: { tracks: written.tracks } },
    clampedTo: ctx.time < floor ? floor : null,
    closes: closingUpdate(lines, crossLine, closeAt),
  };
}

// -- Line slot writing ------------------------------------------------------------

function writeLine(lines: readonly LyricLine[], gestureCtx: GestureContext): SlotWrite | null {
  const ctx = withJumpPastSkipped(lines, gestureCtx, "line");
  const { cursor } = ctx;
  const line = lines[cursor.lineIndex];
  if (!isSyncableLine(line)) return null;

  const anchor = anchorBefore(lines, ctx, "line");
  const { slot } = anchor;
  const range = rangeOfLine(lines, line, ctx);
  const floor = Math.max(anchor.floor, range.min);
  const oldMain = mainBounds(line);
  const delta = oldMain ? clampShiftDelta([line], Math.max(ctx.time, floor) - oldMain.begin, range) : 0;
  const begin = oldMain ? oldMain.begin + delta : Math.max(ctx.time, floor);
  const written = oldMain
    ? withSeededBackground({ ...line, ...shiftLineTiming(line, delta) })
    : withBackgroundFrom(withMainTrack(line, withTrackSpan(mainTrack(line), begin, begin)), begin, null);

  return {
    update: { id: line.id, updates: { tracks: written.tracks } },
    clampedTo: ctx.time < floor ? floor : null,
    closes: closingUpdate(lines, slot, closingTime(lines, slot, begin, { open: false, jumped: ctx.jumped })),
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
  const timed = timedSyllables(mainTrack(line));
  const held = timed[cursor.wordIndex];
  if (!held || held.begin !== held.end) return null;

  const words = enforceOrderAround(closeSlotWords(timed, cursor.wordIndex, time), cursor.wordIndex);
  return {
    update: { id: line.id, updates: { tracks: withRoleWords(line, "main", words).tracks } },
    clampedTo: time < held.begin ? held.begin : null,
    closeEnd: Math.max(time, held.begin),
  };
}

// -- Merge and apply ---------------------------------------------------------------

function mergeUpdates(a: readonly LineUpdate[], b: readonly LineUpdate[]): LineUpdate[] {
  const merged = new Map(a.map((u) => [u.id, u.updates]));
  for (const u of b) {
    const earlier = merged.get(u.id);
    merged.set(u.id, earlier ? { ...earlier, ...u.updates } : u.updates);
  }
  return [...merged].map(([id, updates]) => ({ id, updates }));
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

  const linesAfterClose = applyLineUpdates(lines, [closed.update]);
  const opened = writeWord(linesAfterClose, { ...ctx, cursor: nextCursor, jumped: true, time: closed.closeEnd }, true);
  const lineUpdates = opened ? mergeUpdates([closed.update], [opened.update]) : [closed.update];
  return { lineUpdates, nextCursor, nextJumped: false, clampedTo: closed.clampedTo };
}

// -- Exports ------------------------------------------------------------------

export type { GestureCommit, GestureContext, SyncGesture };
export { commitGesture };
