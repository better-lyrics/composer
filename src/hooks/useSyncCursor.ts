import type { LyricLine } from "@/domain/line/model";
import type { SyncGranularity } from "@/domain/line/sync-progress";
import { storedSyncPosition } from "@/domain/sync/anchor-gesture";
import { resolveSyncCursor } from "@/domain/sync/cursor";
import { skippedSharedInstances, syncPositionPastSkipped } from "@/domain/sync/skipped-instances";
import { useProjectStore } from "@/stores/project";
import type { SyncState } from "@/utils/sync-helpers";
import { useMemo } from "react";

// -- Hook ---------------------------------------------------------------------

function useSyncCursor(lines: readonly LyricLine[], syncState: SyncState, granularity: SyncGranularity) {
  const history = useProjectStore((s) => s.history);
  const historyIndex = useProjectStore((s) => s.historyIndex);
  const groups = useProjectStore((s) => s.groups);
  const skippedInstances = useMemo(() => skippedSharedInstances(lines, groups), [lines, groups]);
  const stored = storedSyncPosition(syncState, { history, historyIndex });
  const { reRecording } = syncState;
  const { cursor, jumped } = useMemo(
    () =>
      syncPositionPastSkipped(
        lines,
        skippedInstances,
        resolveSyncCursor(lines, stored.position, stored.jumped, granularity),
        stored.jumped,
        reRecording,
      ),
    [lines, skippedInstances, stored.position, stored.jumped, granularity, reRecording],
  );
  return { cursor, jumped, skippedInstances };
}

// -- Exports ------------------------------------------------------------------

export { useSyncCursor };
