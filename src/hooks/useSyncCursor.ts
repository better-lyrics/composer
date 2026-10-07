import type { LyricLine } from "@/domain/line/model";
import type { SyncGranularity } from "@/domain/line/sync-progress";
import { storedSyncPosition } from "@/domain/sync/anchor-gesture";
import { resolveSyncCursor } from "@/domain/sync/cursor";
import type { SyncCursor } from "@/domain/sync/cursor";
import {
  type SkippedInstance,
  keptReRecording,
  reRecordingAt,
  skippedSharedInstances,
  syncPositionPastSkipped,
} from "@/domain/sync/skipped-instances";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { useProjectStore } from "@/stores/project";
import type { SyncReRecording, SyncState } from "@/utils/sync-helpers";
import { useMemo } from "react";

// -- Re-recording -------------------------------------------------------------

// A re-record belongs to the project it started in, so a project switch never carries it over.
function syncReRecordingAt(
  skippedInstances: readonly SkippedInstance[],
  lines: readonly LyricLine[],
  lineIndex: number,
): SyncReRecording | undefined {
  const reRecording = reRecordingAt(skippedInstances, lines, lineIndex);
  return reRecording && { ...reRecording, projectId: openProjectIdSnapshot() };
}

function keptSyncReRecording(
  reRecording: SyncReRecording | undefined,
  lines: readonly LyricLine[],
  cursor: SyncCursor,
): SyncReRecording | undefined {
  return reRecording && keptReRecording(reRecording, lines, cursor) && reRecording;
}

// -- Hook ---------------------------------------------------------------------

function useSyncCursor(lines: readonly LyricLine[], syncState: SyncState, granularity: SyncGranularity) {
  const history = useProjectStore((s) => s.history);
  const historyIndex = useProjectStore((s) => s.historyIndex);
  const groups = useProjectStore((s) => s.groups);
  const skippedInstances = useMemo(() => skippedSharedInstances(lines, groups), [lines, groups]);
  const stored = storedSyncPosition(syncState, { history, historyIndex });
  const openProjectId = useOpenProjectId();
  const reRecording = syncState.reRecording?.projectId === openProjectId ? syncState.reRecording : undefined;
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

export { keptSyncReRecording, syncReRecordingAt, useSyncCursor };
