import { instanceStart, instancesInLineOrder, keepsOwnTiming } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { attachedLineIndices } from "@/domain/instance/enumerate";
import { instanceName } from "@/domain/instance/name";
import type { LyricLine } from "@/domain/line/model";
import { isSyncableLine } from "@/domain/line/sync-progress";
import type { SyncCursor } from "@/domain/sync/cursor";
import { sharedAnchorAt } from "@/domain/sync/shared-anchor";

// -- Types --------------------------------------------------------------------

interface LaneGroupTag {
  label: string;
  color: string;
}

// -- Functions ----------------------------------------------------------------

function sharedSuffix(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  group: LinkGroup,
  instanceIdx: number,
  anchorIndex: number,
  cursor: SyncCursor,
): string {
  if (keepsOwnTiming(group, instanceIdx)) return " · own timing";
  if (!sharedAnchorAt(lines, groups, { lineIndex: anchorIndex, wordIndex: 0 })) return "";
  if (instanceStart(lines, group.id, instanceIdx) !== null) return " · placed";
  return cursor.lineIndex === anchorIndex && cursor.wordIndex === 0 ? " · tap to place" : " · shared";
}

function laneGroupTags(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  cursor: SyncCursor,
): Map<string, LaneGroupTag> {
  const tags = new Map<string, LaneGroupTag>();
  for (const group of groups) {
    for (const instanceIdx of instancesInLineOrder(lines, group.id)) {
      const indices = attachedLineIndices(lines, group.id, instanceIdx);
      const first = indices.find((index) => isSyncableLine(lines[index])) ?? indices[0];
      if (first === undefined) continue;
      const suffix = group.sharesTiming ? sharedSuffix(lines, groups, group, instanceIdx, first, cursor) : "";
      tags.set(lines[first].id, { label: `${instanceName(lines, group, instanceIdx)}${suffix}`, color: group.color });
    }
  }
  return tags;
}

function placingInstanceName(lines: readonly LyricLine[], groups: readonly LinkGroup[], cursor: SyncCursor) {
  const anchor = sharedAnchorAt(lines, groups, cursor);
  const group = anchor && groups.find((candidate) => candidate.id === anchor.groupId);
  return anchor && group ? instanceName(lines, group, anchor.instanceIdx) : null;
}

// -- Exports ------------------------------------------------------------------

export { laneGroupTags, placingInstanceName };
export type { LaneGroupTag };
