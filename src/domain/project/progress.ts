import type { ProjectIndexEntry } from "@/domain/project/index-entry";

// -- Types --------------------------------------------------------------------

type ProjectStage = "not-synced" | "syncing" | "synced";
type ProgressCounts = Pick<ProjectIndexEntry, "lineCount" | "syncedLineCount">;

// -- Derivations --------------------------------------------------------------

function hasLyrics({ lineCount }: Pick<ProjectIndexEntry, "lineCount">): boolean {
  return lineCount > 0;
}

function projectStage({ lineCount, syncedLineCount }: ProgressCounts): ProjectStage {
  if (!hasLyrics({ lineCount }) || syncedLineCount <= 0) return "not-synced";
  return syncedLineCount >= lineCount ? "synced" : "syncing";
}

function clampedSyncedLines({ lineCount, syncedLineCount }: ProgressCounts): number {
  return Math.min(Math.max(syncedLineCount, 0), lineCount);
}

function syncedPercent(counts: ProgressCounts): number {
  if (!hasLyrics(counts)) return 0;
  return Math.round((clampedSyncedLines(counts) / counts.lineCount) * 100);
}

function syncedLinesLabel(counts: ProgressCounts): string {
  return `${clampedSyncedLines(counts)} of ${counts.lineCount} lines synced`;
}

function progressDescription(counts: ProgressCounts & Pick<ProjectIndexEntry, "hasWordTiming">): string {
  if (!hasLyrics(counts)) return "No lyrics yet";
  const synced = syncedLinesLabel(counts);
  if (counts.syncedLineCount <= 0) return synced;
  return `${synced}, ${counts.hasWordTiming ? "word by word" : "line by line"}`;
}

// -- Exports ------------------------------------------------------------------

export { hasLyrics, projectStage, syncedPercent, syncedLinesLabel, progressDescription };
export type { ProjectStage, ProgressCounts };
