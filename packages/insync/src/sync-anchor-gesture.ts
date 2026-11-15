import { withOwnTiming } from "./group-own-timing";
import { instanceStart } from "./group-shared-timing";
import { isAttachedToInstance } from "./instance-predicates";
import { applyLineUpdates } from "./line-apply-line-updates";
import { mainBounds } from "./line-bounds";
import type { LineUpdate, LyricLine } from "./line";
import { previousMainEnd } from "./line-neighbour-bounds";
import { type SyncAddress, sameSyncPosition } from "./sync-address";
import { type GestureContext, type SyncGesture, commitGesture } from "./sync-commit-gesture";
import { type SyncCursor, advanceCursor } from "./sync-cursor";
import { sharedAnchorAt } from "./sync-shared-anchor";

// -- Types --------------------------------------------------------------------

interface AnchorGesture {
  groupId: string;
  instanceIdx: number;
  start: number;
  precedingUpdates: LineUpdate[];
  anchorCursor: SyncCursor;
  resumeCursor: SyncCursor;
  clampedTo: number | null;
  // Placed already, and the tap lands before the main track of the line above ends: the tap only ends that line.
  keepsPlacement: boolean;
}

interface AnchorUndo {
  resume: SyncAddress;
  anchor: SyncAddress;
  jumped: boolean;
  placedEntry: object;
  previousEntry: object | undefined;
}

interface HistoryPosition {
  history: readonly object[];
  historyIndex: number;
}

interface StoredSyncPosition {
  position: SyncAddress;
  jumpedToPosition?: boolean;
  anchorUndo?: AnchorUndo;
}

// -- Functions ----------------------------------------------------------------

function anchorSlotOf(
  lines: readonly LyricLine[],
  gesture: SyncGesture,
  cursor: SyncCursor,
  splitChar: string,
): SyncCursor | null {
  if (gesture === "hold-end") return null;
  return gesture === "hold-tap" ? advanceCursor(lines, cursor, "word", splitChar) : cursor;
}

// The anchor instance is written as if it had its own timing, so the shared range of its old position does not floor the tap.
function anchorGesture(lines: readonly LyricLine[], gesture: SyncGesture, ctx: GestureContext): AnchorGesture | null {
  const anchorCursor = anchorSlotOf(lines, gesture, ctx.cursor, ctx.splitChar);
  const anchor = anchorCursor ? sharedAnchorAt(lines, ctx.groups ?? [], anchorCursor, ctx.splitChar) : null;
  if (!anchorCursor || !anchor) return null;
  const { groupId, instanceIdx } = anchor;
  const groups = (ctx.groups ?? []).map((group) =>
    group.id === groupId ? withOwnTiming(group, instanceIdx, true) : group,
  );
  const commit = commitGesture(lines, gesture, { ...ctx, groups, skippedInstances: undefined });
  const anchorLine = lines[anchorCursor.lineIndex];
  const anchorUpdate = commit?.lineUpdates.find((update) => update.id === anchorLine.id);
  const start = anchorUpdate ? mainBounds(applyLineUpdates([anchorLine], [anchorUpdate])[0])?.begin : undefined;
  if (!commit || start === undefined) return null;
  const instanceIds = new Set(
    lines.filter((line) => isAttachedToInstance(line, groupId, instanceIdx)).map((line) => line.id),
  );
  const precedingUpdates = commit.lineUpdates.filter((update) => !instanceIds.has(update.id));
  const lineAboveEnd = previousMainEnd(applyLineUpdates(lines, precedingUpdates), anchorCursor.lineIndex);
  return {
    groupId,
    instanceIdx,
    start,
    precedingUpdates,
    keepsPlacement: instanceStart(lines, groupId, instanceIdx) !== null && start < lineAboveEnd,
    anchorCursor,
    resumeCursor: { lineIndex: anchor.resumeLineIndex, wordIndex: 0 },
    clampedTo: commit.clampedTo,
  };
}

// An undone placing leaves the instance fully timed again when it was moved, so its missing timing cannot find the
// anchor slot. The placing stands while its history entry is at or before the current one, or once it is too old to keep.
function isPlacingUndone(undo: AnchorUndo, { history, historyIndex }: HistoryPosition): boolean {
  const placedAt = history.indexOf(undo.placedEntry);
  if (placedAt !== -1) return placedAt > historyIndex;
  return undo.previousEntry !== undefined && history.includes(undo.previousEntry);
}

function storedSyncPosition(
  state: StoredSyncPosition,
  lines: readonly LyricLine[],
  position: HistoryPosition,
): { position: SyncAddress; jumped: boolean } {
  const undo = state.anchorUndo;
  if (undo && sameSyncPosition(lines, undo.resume, state.position) && isPlacingUndone(undo, position)) {
    return { position: undo.anchor, jumped: undo.jumped };
  }
  return { position: state.position, jumped: !!state.jumpedToPosition };
}

// -- Exports ------------------------------------------------------------------

export { anchorGesture, storedSyncPosition };
export type { AnchorUndo };
