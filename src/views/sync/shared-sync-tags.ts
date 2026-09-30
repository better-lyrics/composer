import type { LinkGroup } from "@/domain/group/template";
import { instanceName } from "@/domain/instance/name";
import type { LyricLine } from "@/domain/line/model";
import { type SyncCursor, nextSyncableLineIndex } from "@/domain/sync/cursor";
import { type SharedAnchor, sharedAnchorAt } from "@/domain/sync/shared-anchor";

// -- Types --------------------------------------------------------------------

interface SharedSyncTag {
  label: string;
  color: string;
  placement: "above" | "below";
}

// -- Functions ----------------------------------------------------------------

function anchorGroup(groups: readonly LinkGroup[], anchor: SharedAnchor | null): LinkGroup | undefined {
  return anchor ? groups.find((group) => group.id === anchor.groupId) : undefined;
}

function sharedSyncTags(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  cursor: SyncCursor,
  skippedLineIds: ReadonlySet<string>,
): Map<string, SharedSyncTag> {
  const tags = new Map<string, SharedSyncTag>();
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  for (let i = 0; i < Math.min(cursor.lineIndex, lines.length); i++) {
    const line = lines[i];
    const group = line.groupId ? groupsById.get(line.groupId) : undefined;
    if (!group || line.instanceIdx === undefined || !skippedLineIds.has(line.id)) continue;
    const label = `${instanceName(lines, group, line.instanceIdx)} · shared`;
    tags.set(line.id, { label, color: group.color, placement: "below" });
  }

  const current = sharedAnchorAt(lines, groups, cursor);
  const currentGroup = anchorGroup(groups, current);
  if (currentGroup) {
    tags.set(lines[cursor.lineIndex].id, { label: "Tap to place", color: currentGroup.color, placement: "above" });
  }

  const nextIndex = nextSyncableLineIndex(lines, cursor.lineIndex);
  const next = nextIndex < lines.length ? sharedAnchorAt(lines, groups, { lineIndex: nextIndex, wordIndex: 0 }) : null;
  const nextGroup = anchorGroup(groups, next);
  if (next && nextGroup) {
    tags.set(lines[nextIndex].id, {
      label: instanceName(lines, nextGroup, next.instanceIdx),
      color: nextGroup.color,
      placement: "below",
    });
  }
  return tags;
}

function placingInstanceName(lines: readonly LyricLine[], groups: readonly LinkGroup[], cursor: SyncCursor) {
  const anchor = sharedAnchorAt(lines, groups, cursor);
  const group = anchorGroup(groups, anchor);
  return anchor && group ? instanceName(lines, group, anchor.instanceIdx) : null;
}

// -- Exports ------------------------------------------------------------------

export { placingInstanceName, sharedSyncTags };
export type { SharedSyncTag };
