import { instanceStart, sharedInstancesInLineOrder } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { isAttachedToInstance } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { isSyncableLine } from "@/domain/line/sync-progress";
import { type SyncCursor, nextSyncableLineIndex } from "@/domain/sync/cursor";
import { sharedAnchorAt } from "@/domain/sync/shared-anchor";

// -- Types --------------------------------------------------------------------

interface SkippedInstance {
  groupId: string;
  instanceIdx: number;
  lineIds: string[];
  syncableLineCount: number;
  firstLineIndex: number;
  lastLineIndex: number;
}

interface InstanceRef {
  groupId: string;
  instanceIdx: number;
}

interface SyncPosition {
  cursor: SyncCursor;
  jumped: boolean;
}

// -- Functions ----------------------------------------------------------------

function attachedLineIndices(lines: readonly LyricLine[], groupId: string, instanceIdx: number): number[] {
  return lines.flatMap((line, index) => (isAttachedToInstance(line, groupId, instanceIdx) ? [index] : []));
}

function skippedInstanceOf(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  groupId: string,
  instanceIdx: number,
): SkippedInstance | null {
  if (instanceStart(lines, groupId, instanceIdx) === null) return null;
  const indices = attachedLineIndices(lines, groupId, instanceIdx);
  const syncable = indices.filter((index) => isSyncableLine(lines[index]));
  if (syncable.length === 0) return null;
  if (!sharedAnchorAt(lines, groups, { lineIndex: syncable[0], wordIndex: 0 })) return null;
  return {
    groupId,
    instanceIdx,
    lineIds: indices.map((index) => lines[index].id),
    syncableLineCount: syncable.length,
    firstLineIndex: syncable[0],
    lastLineIndex: indices[indices.length - 1],
  };
}

// A placed shared instance is skipped when a tap on its first word would place it again from another instance.
function skippedSharedInstances(lines: readonly LyricLine[], groups: readonly LinkGroup[]): SkippedInstance[] {
  return groups
    .filter((group) => group.sharesTiming)
    .flatMap((group) =>
      sharedInstancesInLineOrder(lines, group).flatMap((instanceIdx) => {
        const skipped = skippedInstanceOf(lines, groups, group.id, instanceIdx);
        return skipped ? [skipped] : [];
      }),
    );
}

function skippedInstanceOfLine(
  skippedInstances: readonly SkippedInstance[],
  line: LyricLine | undefined,
): SkippedInstance | undefined {
  return line && skippedInstances.find((instance) => instance.lineIds.includes(line.id));
}

// The instance a jump lands in, recorded so the cursor may stay inside it to re-record it.
function skippedInstanceAt(
  skippedInstances: readonly SkippedInstance[],
  lines: readonly LyricLine[],
  lineIndex: number,
): InstanceRef | undefined {
  const skipped = skippedInstanceOfLine(skippedInstances, lines[lineIndex]);
  return skipped && { groupId: skipped.groupId, instanceIdx: skipped.instanceIdx };
}

// A cursor left inside a skipped instance (for example by grouping mid-sync) resumes after it, so a tap never re-records
// it, unless the user jumped into that instance to re-record it.
function syncPositionPastSkipped(
  lines: readonly LyricLine[],
  skippedInstances: readonly SkippedInstance[],
  cursor: SyncCursor,
  jumped: boolean,
  reRecording?: InstanceRef,
): SyncPosition {
  const unchanged = { cursor, jumped };
  if (jumped) return unchanged;
  const skipped = skippedInstanceOfLine(skippedInstances, lines[cursor.lineIndex]);
  if (!skipped) return unchanged;
  if (reRecording?.groupId === skipped.groupId && reRecording.instanceIdx === skipped.instanceIdx) return unchanged;
  if (cursor.lineIndex === skipped.firstLineIndex && cursor.wordIndex === 0) return unchanged;
  return { cursor: { lineIndex: nextSyncableLineIndex(lines, skipped.lastLineIndex), wordIndex: 0 }, jumped: true };
}

// -- Exports ------------------------------------------------------------------

export { skippedInstanceAt, skippedSharedInstances, syncPositionPastSkipped };
export type { InstanceRef, SkippedInstance };
