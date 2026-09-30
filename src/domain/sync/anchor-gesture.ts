import { withOwnTiming } from "@/domain/group/own-timing";
import { belongsToInstance } from "@/domain/instance/predicates";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import { mainBounds } from "@/domain/line/bounds";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { commitGesture, type GestureContext, type SyncGesture } from "@/domain/sync/commit-gesture";
import { advanceCursor, type SyncCursor } from "@/domain/sync/cursor";
import { sharedAnchorAt } from "@/domain/sync/shared-anchor";

// -- Types --------------------------------------------------------------------

interface AnchorGesture {
  groupId: string;
  instanceIdx: number;
  start: number;
  precedingUpdates: LineUpdate[];
  anchorCursor: SyncCursor;
  resumeCursor: SyncCursor;
  clampedTo: number | null;
}

interface AnchorUndo {
  resume: SyncCursor;
  anchor: SyncCursor;
  jumped: boolean;
  historyIndex: number;
}

interface StoredSyncPosition {
  position: SyncCursor;
  jumpedToPosition?: boolean;
  anchorUndo?: AnchorUndo;
}

// -- Functions ----------------------------------------------------------------

function anchorSlotOf(lines: readonly LyricLine[], gesture: SyncGesture, cursor: SyncCursor): SyncCursor | null {
  if (gesture === "hold-end") return null;
  return gesture === "hold-tap" ? advanceCursor(lines, cursor, "word") : cursor;
}

// The anchor instance is written as if it had its own timing, so the shared range of its old position does not floor the tap.
function anchorGesture(lines: readonly LyricLine[], gesture: SyncGesture, ctx: GestureContext): AnchorGesture | null {
  const anchorCursor = anchorSlotOf(lines, gesture, ctx.cursor);
  const anchor = anchorCursor ? sharedAnchorAt(lines, ctx.groups ?? [], anchorCursor) : null;
  if (!anchorCursor || !anchor) return null;
  const { groupId, instanceIdx } = anchor;
  const groups = (ctx.groups ?? []).map((group) =>
    group.id === groupId ? withOwnTiming(group, instanceIdx, true) : group,
  );
  const commit = commitGesture(lines, gesture, { ...ctx, groups });
  const anchorLine = lines[anchorCursor.lineIndex];
  const anchorUpdate = commit?.lineUpdates.find((update) => update.id === anchorLine.id);
  const start = anchorUpdate ? mainBounds(applyLineUpdates([anchorLine], [anchorUpdate])[0])?.begin : undefined;
  if (!commit || start === undefined) return null;
  const instanceIds = new Set(
    lines.filter((line) => belongsToInstance(line, groupId, instanceIdx) && !line.detached).map((line) => line.id),
  );
  return {
    groupId,
    instanceIdx,
    start,
    precedingUpdates: commit.lineUpdates.filter((update) => !instanceIds.has(update.id)),
    anchorCursor,
    resumeCursor: { lineIndex: anchor.resumeLineIndex, wordIndex: 0 },
    clampedTo: commit.clampedTo,
  };
}

// An instance that was already timed is fully timed again after undo, so the cursor cannot find the anchor slot by its missing timing.
function storedSyncPosition(
  state: StoredSyncPosition,
  historyIndex: number,
): { position: SyncCursor; jumped: boolean } {
  const undo = state.anchorUndo;
  if (undo && undo.resume === state.position && historyIndex < undo.historyIndex) {
    return { position: undo.anchor, jumped: undo.jumped };
  }
  return { position: state.position, jumped: !!state.jumpedToPosition };
}

// -- Exports ------------------------------------------------------------------

export { anchorGesture, storedSyncPosition };
export type { AnchorGesture, AnchorUndo };
