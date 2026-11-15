import {
  firstFullyTimedInstance,
  instanceStart,
  isSharedLine,
  sharedInstancesInLineOrder,
} from "./group-shared-timing";
import type { LinkGroup } from "./group";
import { isAttachedToInstance, isLinked } from "./instance-predicates";
import type { LyricLine } from "./line";
import { isSyncableLine } from "./line-sync-progress";
import type { SyncCursor } from "./sync-cursor";

// -- Types --------------------------------------------------------------------

interface SharedAnchor {
  groupId: string;
  instanceIdx: number;
  resumeLineIndex: number;
}

// -- Functions ----------------------------------------------------------------

function firstSyncableLineIndexOf(
  lines: readonly LyricLine[],
  groupId: string,
  instanceIdx: number,
  splitChar: string,
): number {
  return lines.findIndex((line) => isAttachedToInstance(line, groupId, instanceIdx) && isSyncableLine(line, splitChar));
}

function resumeLineIndexAfter(
  lines: readonly LyricLine[],
  anchorIndex: number,
  groupId: string,
  instanceIdx: number,
  splitChar: string,
) {
  for (let i = anchorIndex + 1; i < lines.length; i++) {
    if (isSyncableLine(lines[i], splitChar) && !isAttachedToInstance(lines[i], groupId, instanceIdx)) return i;
  }
  return lines.length;
}

function hasTimedReference(
  lines: readonly LyricLine[],
  group: LinkGroup,
  instanceIdx: number,
  splitChar: string,
): boolean {
  const order = sharedInstancesInLineOrder(lines, group);
  const unplaced = instanceStart(lines, group.id, instanceIdx) === null;
  const candidates = unplaced ? order : order.slice(0, Math.max(order.indexOf(instanceIdx), 0));
  const others = candidates.filter((otherIdx) => otherIdx !== instanceIdx);
  return firstFullyTimedInstance(lines, group.id, others, splitChar) !== undefined;
}

// The first word of a shared instance places the whole instance when another shared instance already holds the timing.
function sharedAnchorAt(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  cursor: SyncCursor,
  splitChar: string,
): SharedAnchor | null {
  const line = lines[cursor.lineIndex];
  if (cursor.wordIndex !== 0 || !line || !isLinked(line)) return null;
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const group = groupsById.get(line.groupId);
  if (!group || !isSharedLine(line, groupsById)) return null;
  const { groupId, instanceIdx } = line;
  if (firstSyncableLineIndexOf(lines, groupId, instanceIdx, splitChar) !== cursor.lineIndex) return null;
  if (!hasTimedReference(lines, group, instanceIdx, splitChar)) return null;
  return {
    groupId,
    instanceIdx,
    resumeLineIndex: resumeLineIndexAfter(lines, cursor.lineIndex, groupId, instanceIdx, splitChar),
  };
}

// -- Exports ------------------------------------------------------------------

export { sharedAnchorAt };
