import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { hasMainLyrics, isLineSynced } from "@/domain/line/predicates";
import { getSplitCharacter } from "@/utils/split-character";
import { splitIntoWords } from "@/utils/sync-helpers";

// -- Types --------------------------------------------------------------------

type SyncGranularity = "line" | "word";

interface SyncProgress {
  done: number;
  total: number;
}

interface LineSyncFacts {
  splitCharacter: string;
  syncable: boolean;
  timed: boolean;
  slots: number;
  timedWords: number;
  fullyTimed: boolean;
}

// -- Cache --------------------------------------------------------------------

// A tap replaces one line object, so every other line answers from here and a whole-song pass stays cheap.
const factsByLine = new WeakMap<LyricLine, LineSyncFacts>();

function lineSyncFacts(line: LyricLine): LineSyncFacts {
  const splitCharacter = getSplitCharacter();
  const cached = factsByLine.get(line);
  if (cached?.splitCharacter === splitCharacter) return cached;
  const slots = splitIntoWords(line.text).length;
  const lineSynced = isLineSynced(line);
  const timedWords = lineSynced ? slots : Math.min(line.words?.length ?? 0, slots);
  const facts: LineSyncFacts = {
    splitCharacter,
    syncable: hasMainLyrics(line),
    timed: effectiveBounds(line) !== null,
    slots,
    timedWords,
    fullyTimed: lineSynced || (slots > 0 && timedWords === slots),
  };
  factsByLine.set(line, facts);
  return facts;
}

// -- Predicates ---------------------------------------------------------------

function isSyncableLine(line: LyricLine | undefined): line is LyricLine {
  return !!line && lineSyncFacts(line).syncable;
}

function isLineTimed(line: LyricLine): boolean {
  return lineSyncFacts(line).timed;
}

function wordSlotCount(line: LyricLine): number {
  return lineSyncFacts(line).slots;
}

function isLineFullyTimed(line: LyricLine): boolean {
  return lineSyncFacts(line).fullyTimed;
}

// -- Aggregates ---------------------------------------------------------------

function syncProgress(lines: readonly LyricLine[], granularity: SyncGranularity): SyncProgress {
  let done = 0;
  let total = 0;
  for (const line of lines) {
    const facts = lineSyncFacts(line);
    if (!facts.syncable) continue;
    total += granularity === "line" ? 1 : facts.slots;
    if (granularity === "word") done += facts.timedWords;
    else if (facts.timed) done += 1;
  }
  return { done, total };
}

function isSyncComplete(lines: readonly LyricLine[]): boolean {
  let syncableCount = 0;
  for (const line of lines) {
    const facts = lineSyncFacts(line);
    if (!facts.syncable) continue;
    if (!facts.fullyTimed) return false;
    syncableCount += 1;
  }
  return syncableCount > 0;
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
