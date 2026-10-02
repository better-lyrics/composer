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

// A cursor left inside a skipped instance (for example by grouping mid-sync) resumes after it, so a tap never re-records it.
function syncPositionPastSkipped(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  cursor: SyncCursor,
  jumped: boolean,
): SyncPosition {
  const unchanged = { cursor, jumped };
  const line = lines[cursor.lineIndex];
  if (jumped || !line || !groups.some((group) => group.sharesTiming)) return unchanged;
  const skipped = skippedSharedInstances(lines, groups).find((instance) => instance.lineIds.includes(line.id));
  if (!skipped) return unchanged;
  if (cursor.lineIndex === skipped.firstLineIndex && cursor.wordIndex === 0) return unchanged;
  return { cursor: { lineIndex: nextSyncableLineIndex(lines, skipped.lastLineIndex), wordIndex: 0 }, jumped: true };
}

// -- Exports ------------------------------------------------------------------

export { skippedSharedInstances, syncPositionPastSkipped };
export type { SkippedInstance };
