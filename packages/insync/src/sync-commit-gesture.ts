import { type TimeRange, timeRangeResolver } from "./group-shared-timing";
import type { LinkGroup } from "./group";
import { applyLineUpdates } from "./line-apply-line-updates";
import { bgBounds, mainBounds } from "./line-bounds";
import { withBackgroundSeededFrom, withSeededBackground } from "./line-background";
import type { LineUpdate, LyricLine } from "./line";
import { clampShiftDelta, shiftLineTiming, shiftTrack } from "./line-shift";
import { backgroundTrack, mainTrack, timedSyllables } from "./line-track";
import { withBackgroundTrack, withMainTrack, withRoleWords, withTrackSpan } from "./line-track-writes";
import { type SyncGranularity, isSyncableLine } from "./line-sync-progress";
import { type SyncCursor, advanceCursor, previousSlot } from "./sync-cursor";
import { type SkippedInstance, skippedSharedInstances } from "./sync-skipped-instances";
import { anchorBefore, earlyWithoutRoom } from "./sync-early-tap";
import { closeHeld, closeHeldLine } from "./sync-hold-close";
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
  // Holds time single words unless the pass is in Line mode.
  granularity?: SyncGranularity;
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
  return timeRangeResolver(lines, ctx.groups ?? [], ctx.songEnd ?? Number.POSITIVE_INFINITY)(line);
}

// -- Background -----------------------------------------------------------------

function withBackgroundFrom(line: LyricLine, begin: number, oldMain: Bounds | null, ctx: GestureContext): LyricLine {
  const background = backgroundTrack(line);
  const songEnd = ctx.songEnd ?? Number.POSITIVE_INFINITY;
  const bounds = bgBounds(line);
  if (!background || !bounds) return withBackgroundSeededFrom(line, begin, songEnd, ctx.splitChar);
  if (!oldMain) return line;
  const delta = begin - oldMain.begin;
  const room = Math.max(0, songEnd - bounds.end);
  return withBackgroundTrack(line, shiftTrack(background, delta > 0 ? Math.min(delta, room) : delta));
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
  const range = rangeOfLine(lines, line, ctx);
  const floor = Math.max(crossLine ? 0 : anchor.floor, range.min);
  const begin = Math.max(ctx.time, floor);
  if (begin >= range.max) return "no-room";
  const provisional = open ? begin : Math.min(tapEnd(begin, ctx.defaultWordDuration), range.max);
  const end = nextWord && nextWord.begin > begin ? Math.min(provisional, nextWord.begin) : provisional;

  let words = withSlotWord(existing, slots, cursor.wordIndex, { begin, end });

  const previousEnd = previousSlotEnd(lines, slot, {
    lineIndex: cursor.lineIndex,
    keepsSetEnds: true,
    replacedBegin: cursor.wordIndex === 0 ? mainBounds(line)?.begin : existing[cursor.wordIndex]?.begin,
    begin,
    open,
    jumped: ctx.jumped,
    defaultWordDuration: ctx.defaultWordDuration,
    songEnd: ctx.songEnd ?? Number.POSITIVE_INFINITY,
  });
  const sameLine = slot && slot.lineIndex === cursor.lineIndex ? slot : null;
  if (sameLine && sameLine.wordIndex !== null && previousEnd !== null) {
    words = closeSlotWords(words, sameLine.wordIndex, previousEnd);
  }
  words = enforceOrderAround(words, cursor.wordIndex, range.max);

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
  // A line the song end pulls back onto the previous slot would end that slot before it begins.
  if (begin < floor || begin >= range.max || (anchor.previous && begin <= anchor.previous.begin)) return "no-room";
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
        songEnd: ctx.songEnd ?? Number.POSITIVE_INFINITY,
      }),
    ),
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

// A Line mode hold starts its line the way a tap does; only its release differs.
function lineModeGesture(gesture: SyncGesture, granularity: SyncGranularity | undefined): SyncGesture {
  return granularity === "line" && (gesture === "hold-start" || gesture === "hold-tap") ? "tap-line" : gesture;
}

function planGesture(lines: readonly LyricLine[], requested: SyncGesture, ctx: GestureContext): GesturePlan {
  const gesture = lineModeGesture(requested, ctx.granularity);
  if (gesture === "hold-end" && ctx.granularity === "line") {
    const release = { ...ctx, rangeEnd: ctx.songEnd ?? Number.POSITIVE_INFINITY };
    const closed = closeHeldLine(lines, release, ctx.splitChar);
    return (
      closed && { lineUpdates: [closed.update], nextCursor: ctx.cursor, nextJumped: false, clampedTo: closed.clampedTo }
    );
  }
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
      if (closed === "no-room" || !closed) return closed;
      return { lineUpdates: [closed], nextCursor: ctx.cursor, nextJumped: false, clampedTo: null };
    }
    return {
      lineUpdates: slotWriteToUpdates(write),
      nextCursor: advanceCursor(lines, ctx.cursor, "line", ctx.splitChar),
      nextJumped: false,
      clampedTo: write.clampedTo,
    };
  }

  const held = lines[ctx.cursor.lineIndex];
  const rangeEnd = held ? rangeOfLine(lines, held, ctx).max : Number.POSITIVE_INFINITY;
  const closed = closeHeld(lines, { ...ctx, rangeEnd });
  if (!closed) return null;
  const nextCursor = advanceCursor(lines, ctx.cursor, "word", ctx.splitChar);

  const ended = { lineUpdates: [closed.update], nextCursor, nextJumped: false, clampedTo: closed.clampedTo };
  if (gesture === "hold-end") return ended;

  const linesAfterClose = applyLineUpdates(lines, [closed.update]);
  const opened = writeWord(linesAfterClose, { ...ctx, cursor: nextCursor, jumped: true, time: closed.closeEnd }, true);
  // At the song end nothing more can open, so the tap only ends the held word.
  if (opened === "no-room") return closed.closeEnd >= rangeEnd ? ended : opened;
  const lineUpdates = opened ? mergeUpdates([closed.update], [opened.update]) : [closed.update];
  return { lineUpdates, nextCursor, nextJumped: false, clampedTo: closed.clampedTo };
}

function commitGesture(lines: readonly LyricLine[], gesture: SyncGesture, ctx: GestureContext): GestureCommit | null {
  const plan = planGesture(lines, gesture, ctx);
  return plan === "no-room" ? null : plan;
}

// -- Exports ------------------------------------------------------------------

export type { GestureCommit, GestureContext, GesturePlan, SyncGesture };
export { commitGesture, lineModeGesture, planGesture };
