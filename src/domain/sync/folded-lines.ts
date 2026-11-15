import { sharedInstancesInLineOrder } from "@/domain/group/shared-timing";
import type { LinkGroup } from "insync/group";
import { attachedLineIndices } from "insync/instance-enumerate";
import type { LyricLine } from "insync/line";
import { isSyncableLine } from "insync/line-sync-progress";
import type { SyncCursor } from "insync/sync-cursor";
import { sharedAnchorAt } from "@/domain/sync/shared-anchor";

// -- Functions ----------------------------------------------------------------

// A shared instance placed by one tap shows only its first line, unless the cursor re-records inside it.
function foldedLineIds(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  cursor: SyncCursor,
  splitChar: string,
): Set<string> {
  const folded = new Set<string>();
  for (const group of groups) {
    if (!group.sharesTiming) continue;
    for (const instanceIdx of sharedInstancesInLineOrder(lines, group)) {
      const indices = attachedLineIndices(lines, group.id, instanceIdx);
      const anchor = indices.find((index) => isSyncableLine(lines[index], splitChar));
      if (anchor === undefined || !sharedAnchorAt(lines, groups, { lineIndex: anchor, wordIndex: 0 }, splitChar))
        continue;
      const onAnchor = cursor.lineIndex === anchor && cursor.wordIndex === 0;
      if (indices.includes(cursor.lineIndex) && !onAnchor) continue;
      for (const index of indices) if (index !== anchor) folded.add(lines[index].id);
    }
  }
  return folded;
}

// -- Exports ------------------------------------------------------------------

export { foldedLineIds };
