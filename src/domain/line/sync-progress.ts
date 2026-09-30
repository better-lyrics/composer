import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { hasMainLyrics, isLineSynced } from "@/domain/line/predicates";
import { splitIntoWords } from "@/utils/sync-helpers";

// -- Types --------------------------------------------------------------------

type SyncGranularity = "line" | "word";

interface SyncProgress {
  done: number;
  total: number;
}

// -- Predicates ---------------------------------------------------------------

function isSyncableLine(line: LyricLine | undefined): line is LyricLine {
  return !!line && hasMainLyrics(line);
}

function isLineTimed(line: LyricLine): boolean {
  return effectiveBounds(line) !== null;
}

function wordSlotCount(line: LyricLine): number {
  return splitIntoWords(line.text).length;
}

function timedWordCount(line: LyricLine): number {
  return Math.min(line.words?.length ?? 0, wordSlotCount(line));
}

function isLineFullyTimed(line: LyricLine): boolean {
  if (isLineSynced(line)) return true;
  const slots = wordSlotCount(line);
  return slots > 0 && timedWordCount(line) === slots;
}

// -- Aggregates ---------------------------------------------------------------

function syncProgress(lines: readonly LyricLine[], granularity: SyncGranularity): SyncProgress {
  const syncable = lines.filter(isSyncableLine);
  if (granularity === "line") return { done: syncable.filter(isLineTimed).length, total: syncable.length };
  let done = 0;
  let total = 0;
  for (const line of syncable) {
    done += timedWordCount(line);
    total += wordSlotCount(line);
  }
  return { done, total };
}

function isSyncComplete(lines: readonly LyricLine[]): boolean {
  const syncable = lines.filter(isSyncableLine);
  return syncable.length > 0 && syncable.every(isLineFullyTimed);
}

function isBackgroundFullyTimed(line: LyricLine): boolean {
  const backgroundWords = line.backgroundWords ?? [];
  if (!line.backgroundText?.trim() || backgroundWords.length === 0) return true;
  return backgroundWords.length >= splitIntoWords(line.backgroundText).length;
}

function isProjectFullySynced(lines: readonly LyricLine[]): boolean {
  return (
    isSyncComplete(lines) &&
    lines.every((line) => (hasMainLyrics(line) ? isBackgroundFullyTimed(line) : !line.backgroundText?.trim()))
  );
}

// -- Exports ------------------------------------------------------------------

export {
  isLineFullyTimed,
  isLineTimed,
  isProjectFullySynced,
  isSyncableLine,
  isSyncComplete,
  syncProgress,
  wordSlotCount,
};
export type { SyncGranularity };
