import {
  instanceStart,
  firstFullyTimedInstance,
  isSharedLine,
  sharedInstancesInLineOrder,
} from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { isAttachedToInstance, isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { isSyncableLine } from "@/domain/line/sync-progress";
import type { SyncCursor } from "@/domain/sync/cursor";

// -- Types --------------------------------------------------------------------

interface SharedAnchor {
  groupId: string;
  instanceIdx: number;
  resumeLineIndex: number;
}

// -- Functions ----------------------------------------------------------------

function firstSyncableLineIndexOf(lines: readonly LyricLine[], groupId: string, instanceIdx: number): number {
  return lines.findIndex((line) => isAttachedToInstance(line, groupId, instanceIdx) && isSyncableLine(line));
}

function resumeLineIndexAfter(lines: readonly LyricLine[], anchorIndex: number, groupId: string, instanceIdx: number) {
  for (let i = anchorIndex + 1; i < lines.length; i++) {
    if (isSyncableLine(lines[i]) && !isAttachedToInstance(lines[i], groupId, instanceIdx)) return i;
  }
  return lines.length;
}

function hasTimedReference(lines: readonly LyricLine[], group: LinkGroup, instanceIdx: number): boolean {
  const order = sharedInstancesInLineOrder(lines, group);
  const unplaced = instanceStart(lines, group.id, instanceIdx) === null;
  const candidates = unplaced ? order : order.slice(0, Math.max(order.indexOf(instanceIdx), 0));
  const others = candidates.filter((otherIdx) => otherIdx !== instanceIdx);
  return firstFullyTimedInstance(lines, group.id, others) !== undefined;
}

// The first word of a shared instance places the whole instance when another shared instance already holds the timing.
function sharedAnchorAt(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  cursor: SyncCursor,
): SharedAnchor | null {
  const line = lines[cursor.lineIndex];
  if (cursor.wordIndex !== 0 || !line || !isLinked(line)) return null;
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const group = groupsById.get(line.groupId);
  if (!group || !isSharedLine(line, groupsById)) return null;
  const { groupId, instanceIdx } = line;
  if (firstSyncableLineIndexOf(lines, groupId, instanceIdx) !== cursor.lineIndex) return null;
  if (!hasTimedReference(lines, group, instanceIdx)) return null;
  return { groupId, instanceIdx, resumeLineIndex: resumeLineIndexAfter(lines, cursor.lineIndex, groupId, instanceIdx) };
}

// -- Exports ------------------------------------------------------------------

export { sharedAnchorAt };
export type { SharedAnchor };
