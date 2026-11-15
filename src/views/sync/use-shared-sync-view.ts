import type { LinkGroup } from "insync/group";
import type { LyricLine } from "insync/line";
import type { SyncCursor } from "insync/sync-cursor";
import { foldedLineIds } from "insync/sync-folded-lines";
import type { SkippedInstance } from "insync/sync-skipped-instances";
import { laneGroupTags, placingInstanceName } from "@/views/sync/shared-sync-tags";
import { useMemo } from "react";
import { getSplitCharacter } from "@/utils/split-character";

// -- Hooks --------------------------------------------------------------------

function useSharedSyncView(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  cursor: SyncCursor,
  skippedInstances: readonly SkippedInstance[],
) {
  const skippedLineIds = useMemo(
    () => new Set(skippedInstances.flatMap((instance) => instance.lineIds)),
    [skippedInstances],
  );
  const skippedByLastLineId = useMemo(
    () =>
      new Map<string, SkippedInstance>(
        skippedInstances.map((instance) => [lines[instance.lastLineIndex].id, instance]),
      ),
    [skippedInstances, lines],
  );
  const groupTags = useMemo(() => laneGroupTags(lines, groups, cursor), [lines, groups, cursor]);
  const placingName = useMemo(() => placingInstanceName(lines, groups, cursor), [lines, groups, cursor]);
  const folded = useMemo(() => foldedLineIds(lines, groups, cursor, getSplitCharacter()), [lines, groups, cursor]);
  return { skippedLineIds, skippedByLastLineId, groupTags, folded, placingName };
}

// -- Exports ------------------------------------------------------------------

export { useSharedSyncView };
