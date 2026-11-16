import { type TimeRange, timeRangeResolver } from "./group-shared-timing";
import type { LinkGroup } from "./group";
import { applyLineUpdates } from "./line-apply-line-updates";
import { bgBounds, mainBounds } from "./line-bounds";
import { withBackgroundSeededFrom, withSeededBackground } from "./line-background";
import type { LineUpdate, LyricLine } from "./line";
import { clampShiftDelta, shiftLineTiming, shiftTrack } from "./line-shift";
import { backgroundTrack, mainTrack, timedSyllables } from "./line-track";
import { withBackgroundTrack, withMainTrack, withRoleWords, withTrackSpan } from "./line-track-writes";
import { isSyncableLine } from "./line-sync-progress";
import { type SyncCursor, type SyncSlot, advanceCursor, previousSlot, slotBounds } from "./sync-cursor";
import { type SkippedInstance, skippedSharedInstances } from "./sync-skipped-instances";
import { closeSlotWords, closingUpdate, lastLineClose, previousSlotEnd, tapEnd } from "./sync-slot-close";
import { withSlotWord } from "./sync-slot-words";
import type { Bounds } from "./word-bounds";
import { enforceOrderAround } from "./word-order";

// -- Types --------------------------------------------------------------------

type SyncGesture = "tap-word" | "tap-line" | "hold-start" | "hold-end" | "hold-tap";

interface GestureContext {
  cursor: SyncCursor;
  jumped: boolean;
  time: number;
  defaultWordDuration: number;
  groups?: readonly LinkGroup[];
  skippedInstances?: readonly SkippedInstance[];
  splitChar: string;
  // Where the song ends; unbounded when not given.
  songEnd?: number;
}

interface GestureCommit {
  lineUpdates: LineUpdate[];
  nextCursor: SyncCursor;
  nextJumped: boolean;
  clampedTo: number | null;
}

// An early tap snaps to the previous slot's end; with no room left there it is refused.
type GesturePlan = GestureCommit | "no-room" | null;

interface SlotWrite {
  update: LineUpdate;
  clampedTo: number | null;
  closes: LineUpdate | null;
}

// -- Floor ----------------------------------------------------------------

interface Anchor {
  slot: SyncSlot | null;
  floor: number;
  early: boolean;
  previous: Bounds | null;
}

function closableSlot(lines: readonly LyricLine[], slot: SyncSlot): SyncSlot {
  const line = lines[slot.lineIndex];
  const words = line ? timedSyllables(mainTrack(line)) : [];
  return slot.wordIndex === null && words.length ? { lineIndex: slot.lineIndex, wordIndex: words.length - 1 } : slot;
}

const NO_ANCHOR: Anchor = { slot: null, floor: 0, early: false, previous: null };

// A tap may start inside the previous slot; one that lands at or before that slot begins is early and snaps to its end.
function anchorBefore(lines: readonly LyricLine[], ctx: GestureContext, granularity: "line" | "word"): Anchor {
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

// A placed shared instance keeps the shared end of its last word, even when an undo lost the jump past it.
function followsSkippedInstance(
  lines: readonly LyricLine[],
  ctx: GestureContext,
  granularity: "line" | "word",
): boolean {
  const previous = previousSlot(lines, ctx.cursor, granularity, ctx.splitChar);
  if (!previous || !ctx.groups?.some((group) => group.sharesTiming)) return false;
  const previousId = lines[previous.lineIndex].id;
  const skippedInstances = ctx.skippedInstances ?? skippedSharedInstances(lines, ctx.groups, ctx.splitChar);
  return skippedInstances.some((skipped) => skipped.lineIds.includes(previousId));
}

function withJumpPastSkipped(lines: readonly LyricLine[], ctx: GestureContext, granularity: "line" | "word") {
  return ctx.jumped || !followsSkippedInstance(lines, ctx, granularity) ? ctx : { ...ctx, jumped: true };
}

function rangeOfLine(lines: readonly LyricLine[], line: LyricLine, ctx: GestureContext): TimeRange {
  return timeRangeResolver(lines, ctx.groups ?? [], Number.POSITIVE_INFINITY)(line);
}

// -- Background -----------------------------------------------------------------

function withBackgroundFrom(line: LyricLine, begin: number, oldMain: Bounds | null, ctx: GestureContext): LyricLine {
  const background = backgroundTrack(line);
  if (!background || !bgBounds(line)) {
    return withBackgroundSeededFrom(line, begin, ctx.songEnd ?? Number.POSITIVE_INFINITY, ctx.splitChar);
  }
  return oldMain ? withBackgroundTrack(line, shiftTrack(background, begin - oldMain.begin)) : line;
}

// -- Word slot writing ----------------------------------------------------------

function writeWord(
  lines: readonly LyricLine[],
  gestureCtx: GestureContext,
  open: boolean,
): SlotWrite | "no-room" | null {
  const ctx = withJumpPastSkipped(lines, gestureCtx, "word");
  const { cursor } = ctx;
  const line = lines[cursor.lineIndex];
  if (!isSyncableLine(line, ctx.splitChar)) return null;
  const slots = mainTrack(line).syllables;
  const existing = timedSyllables(mainTrack(line));
  if (!slots[cursor.wordIndex]?.text || cursor.wordIndex > existing.length) return null;

  const anchor = anchorBefore(lines, ctx, "word");
  const { slot } = anchor;
  const crossLine = slot && slot.lineIndex !== cursor.lineIndex ? slot : null;
  const nextWord = existing[cursor.wordIndex + 1];
  if (!crossLine && earlyWithoutRoom(anchor, open ? undefined : nextWord?.begin)) return "no-room";
  const floor = Math.max(crossLine ? 0 : anchor.floor, rangeOfLine(lines, line, ctx).min);
  const begin = Math.max(ctx.time, floor);
  const provisional = open ? begin : tapEnd(begin, ctx.defaultWordDuration);
  const end = nextWord && nextWord.begin >= begin ? Math.min(provisional, nextWord.begin) : provisional;

  let words = withSlotWord(existing, slots, cursor.wordIndex, { begin, end });

  const previousEnd = previousSlotEnd(lines, slot, {
    lineIndex: cursor.lineIndex,
    keepsSetEnds: true,
    replacedBegin: cursor.wordIndex === 0 ? mainBounds(line)?.begin : existing[cursor.wordIndex]?.begin,
    begin,
    open,
    jumped: ctx.jumped,
    defaultWordDuration: ctx.defaultWordDuration,
  });
  const sameLine = slot && slot.lineIndex === cursor.lineIndex ? slot : null;
  if (sameLine && sameLine.wordIndex !== null && previousEnd !== null) {
    words = closeSlotWords(words, sameLine.wordIndex, previousEnd);
  }
  words = enforceOrderAround(words, cursor.wordIndex);

  const timed = withRoleWords(line, "main", words);
  const written = cursor.wordIndex === 0 ? withBackgroundFrom(timed, begin, mainBounds(line), ctx) : timed;

  return {
    update: { id: line.id, updates: { tracks: written.tracks } },
    clampedTo: ctx.time < floor ? floor : null,
    closes: closingUpdate(lines, crossLine, previousEnd),
  };
}

// -- Line slot writing ------------------------------------------------------------

function writeLine(lines: readonly LyricLine[], gestureCtx: GestureContext): SlotWrite | "no-room" | null {
  const ctx = withJumpPastSkipped(lines, gestureCtx, "line");
  const { cursor } = ctx;
  const line = lines[cursor.lineIndex];
  if (!isSyncableLine(line, ctx.splitChar)) return null;

  const anchor = anchorBefore(lines, ctx, "line");
  if (earlyWithoutRoom(anchor, undefined)) return "no-room";
  const { slot } = anchor;
  const range = rangeOfLine(lines, line, ctx);
  const floor = Math.max(anchor.floor, range.min);
  const oldMain = mainBounds(line);
  const delta = oldMain ? clampShiftDelta([line], Math.max(ctx.time, floor) - oldMain.begin, range) : 0;
  const begin = oldMain ? oldMain.begin + delta : Math.max(ctx.time, floor);
  const written = oldMain
    ? withSeededBackground({ ...line, ...shiftLineTiming(line, delta) }, ctx.splitChar, ctx.songEnd)
    : withBackgroundFrom(withMainTrack(line, withTrackSpan(mainTrack(line), begin, begin)), begin, null, ctx);

  return {
    update: { id: line.id, updates: { tracks: written.tracks } },
    clampedTo: ctx.time < floor ? floor : null,
    closes: closingUpdate(
      lines,
      slot,
      // A Line mode tap shifts the whole line, end included, so an end this pass moved reads as set.
      previousSlotEnd(lines, slot, {
        lineIndex: cursor.lineIndex,
        keepsSetEnds: false,
        replacedBegin: oldMain?.begin,
        begin,
        open: false,
        jumped: ctx.jumped,
        defaultWordDuration: ctx.defaultWordDuration,
      }),
    ),
  };
}

// -- Hold close -------------------------------------------------------------------

interface ClosedHold {
  update: LineUpdate;
  clampedTo: number | null;
  closeEnd: number;
}

function closeHeld(lines: readonly LyricLine[], ctx: GestureContext): ClosedHold | null {
  const { cursor, time, defaultWordDuration } = ctx;
  const line = lines[cursor.lineIndex];
  if (!line) return null;
  const timed = timedSyllables(mainTrack(line));
  const held = timed[cursor.wordIndex];
  if (!held || held.begin !== held.end) return null;

  const closeEnd = time > held.begin ? time : tapEnd(held.begin, defaultWordDuration);
  const words = enforceOrderAround(closeSlotWords(timed, cursor.wordIndex, closeEnd), cursor.wordIndex);
  return {
    update: { id: line.id, updates: { tracks: withRoleWords(line, "main", words).tracks } },
    clampedTo: time < held.begin ? held.begin : null,
    closeEnd,
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

function planGesture(lines: readonly LyricLine[], gesture: SyncGesture, ctx: GestureContext): GesturePlan {
  if (gesture === "tap-word" || gesture === "hold-start") {
    const open = gesture === "hold-start";
    const write = writeWord(lines, ctx, open);
    if (!write || write === "no-room") return write;
    return {
      lineUpdates: slotWriteToUpdates(write),
      nextCursor: open ? ctx.cursor : advanceCursor(lines, ctx.cursor, "word", ctx.splitChar),
      nextJumped: open ? ctx.jumped : false,
      clampedTo: write.clampedTo,
    };
  }

  if (gesture === "tap-line") {
    const write = writeLine(lines, ctx);
    if (write === "no-room") return write;
    if (!write) {
      const closed = lastLineClose(lines, ctx.cursor, ctx.time, ctx.splitChar);
      return closed && { lineUpdates: [closed], nextCursor: ctx.cursor, nextJumped: false, clampedTo: null };
    }
    return {
      lineUpdates: slotWriteToUpdates(write),
      nextCursor: advanceCursor(lines, ctx.cursor, "line", ctx.splitChar),
      nextJumped: false,
      clampedTo: write.clampedTo,
    };
  }

  const closed = closeHeld(lines, ctx);
  if (!closed) return null;
  const nextCursor = advanceCursor(lines, ctx.cursor, "word", ctx.splitChar);

  if (gesture === "hold-end") {
    return { lineUpdates: [closed.update], nextCursor, nextJumped: false, clampedTo: closed.clampedTo };
  }

  const linesAfterClose = applyLineUpdates(lines, [closed.update]);
  const opened = writeWord(linesAfterClose, { ...ctx, cursor: nextCursor, jumped: true, time: closed.closeEnd }, true);
  if (opened === "no-room") return opened;
  const lineUpdates = opened ? mergeUpdates([closed.update], [opened.update]) : [closed.update];
  return { lineUpdates, nextCursor, nextJumped: false, clampedTo: closed.clampedTo };
}

function commitGesture(lines: readonly LyricLine[], gesture: SyncGesture, ctx: GestureContext): GestureCommit | null {
  const plan = planGesture(lines, gesture, ctx);
  return plan === "no-room" ? null : plan;
}

// -- Exports ------------------------------------------------------------------

export type { GestureCommit, GestureContext, GesturePlan, SyncGesture };
export { commitGesture, planGesture };
