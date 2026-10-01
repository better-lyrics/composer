import { instanceStart, sharedInstancesInLineOrder } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { isAttachedToInstance } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { isSyncableLine } from "@/domain/line/sync-progress";
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

// -- Functions ----------------------------------------------------------------

function attachedLineIndices(lines: readonly LyricLine[], groupId: string, instanceIdx: number): number[] {
  return lines.flatMap((line, index) =>
    isAttachedToInstance(line, groupId, instanceIdx) ? [index] : [],
  );
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

// -- Exports ------------------------------------------------------------------

export { skippedSharedInstances };
export type { SkippedInstance };
