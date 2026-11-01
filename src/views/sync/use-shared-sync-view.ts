import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { SyncCursor } from "@/domain/sync/cursor";
import type { SkippedInstance } from "@/domain/sync/skipped-instances";
import { placingInstanceName, sharedSyncTags } from "@/views/sync/shared-sync-tags";
import { useMemo } from "react";

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
  const sharedTags = useMemo(
    () => sharedSyncTags(lines, groups, cursor, skippedLineIds),
    [lines, groups, cursor, skippedLineIds],
  );
  const placingName = useMemo(() => placingInstanceName(lines, groups, cursor), [lines, groups, cursor]);
  return { skippedLineIds, skippedByLastLineId, sharedTags, placingName };
}

// -- Exports ------------------------------------------------------------------

export { useSharedSyncView };
