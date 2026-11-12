import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { hasMainLyrics, isLineSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// -- Types --------------------------------------------------------------------

type SyncGranularity = "line" | "word";

interface SyncProgress {
  done: number;
  total: number;
}

type SyncGapTrack = "main" | "background";

// untimed: the track has no timing. partial: some slots have no timing of their own.
// background-only: background vocals on a line with no main lyrics, which cannot export.
type SyncGapKind = "untimed" | "partial" | "background-only";

interface SyncGap {
  lineId: string;
  lineIndex: number;
  track: SyncGapTrack;
  kind: SyncGapKind;
  timedSlots: number;
  slotCount: number;
  problemSlots: readonly number[];
}

// Slot indexes [start, end) into `splitIntoWordsWithMeta(text).parts` that one timed word covers.
interface SlotRange {
  start: number;
  end: number;
}

type TrackGap = Omit<SyncGap, "lineIndex">;

interface LineSyncFacts {
  splitCharacter: string;
  syncable: boolean;
  timed: boolean;
  slots: number;
  timedWords: number;
  fullyTimed: boolean;
  backgroundComplete: boolean;
  trackGaps: readonly TrackGap[];
}

// -- Gaps ---------------------------------------------------------------------

function lettersOf(text: string, splitCharacter: string): string {
  return [...text].filter((char) => char.trim() !== "" && char !== splitCharacter).join("");
}

// A timed word spans several slots only when its letters are exactly those slots joined, so stale word text never merges slots.
function slotsCoveredBy(parts: readonly string[], slot: number, timed: WordTiming, splitCharacter: string): number {
  const letters = lettersOf(timed.text, splitCharacter);
  let joined = parts[slot];
  let end = slot + 1;
  while (joined.length < letters.length && end < parts.length && letters.startsWith(joined)) joined += parts[end++];
  return joined === letters ? end - slot : 1;
}

function slotRangesOf(parts: readonly string[], words: readonly WordTiming[], splitCharacter: string): SlotRange[] {
  const ranges: SlotRange[] = [];
  let slot = 0;
  for (const timed of words) {
    if (slot >= parts.length) break;
    const end = slot + slotsCoveredBy(parts, slot, timed, splitCharacter);
    ranges.push({ start: slot, end });
    slot = end;
  }
  return ranges;
}

function problemSlotsOf(parts: readonly string[], words: readonly WordTiming[], splitCharacter: string): number[] {
  const problems: number[] = [];
  const ranges = slotRangesOf(parts, words, splitCharacter);
  for (const { start, end } of ranges) {
    if (end - start > 1) for (let index = start; index < end; index++) problems.push(index);
  }
  for (let index = ranges.at(-1)?.end ?? 0; index < parts.length; index++) problems.push(index);
  return problems;
}

function timedWordSlotRanges(text: string, words: readonly WordTiming[]): SlotRange[] {
  return slotRangesOf(splitIntoWordsWithMeta(text).parts, words, getSplitCharacter());
}

function trackGap(
  lineId: string,
  track: SyncGapTrack,
  parts: readonly string[],
  words: readonly WordTiming[],
  splitCharacter: string,
): TrackGap | null {
  const slotCount = parts.length;
  if (words.length === 0) return { lineId, track, kind: "untimed", timedSlots: 0, slotCount, problemSlots: [] };
  const problemSlots = problemSlotsOf(parts, words, splitCharacter);
  if (problemSlots.length === 0) return null;
  return { lineId, track, kind: "partial", timedSlots: slotCount - problemSlots.length, slotCount, problemSlots };
}

function backgroundGap(line: LyricLine, splitCharacter: string): TrackGap | null {
  const backgroundText = line.backgroundText ?? "";
  if (!backgroundText.trim()) return null;
  const parts = splitIntoWordsWithMeta(backgroundText).parts;
  const backgroundWords = line.backgroundWords ?? [];
  if (!hasMainLyrics(line)) {
    return {
      lineId: line.id,
      track: "background",
      kind: "background-only",
      timedSlots: 0,
      slotCount: parts.length,
      problemSlots: [],
    };
  }
  // A line-synced line times its background with the line itself.
  if (isLineSynced(line) && backgroundWords.length === 0) return null;
  return trackGap(line.id, "background", parts, backgroundWords, splitCharacter);
}

function mainGap(line: LyricLine, parts: readonly string[], splitCharacter: string): TrackGap | null {
  if (!hasMainLyrics(line) || isLineSynced(line)) return null;
  return trackGap(line.id, "main", parts, line.words ?? [], splitCharacter);
}

// -- Cache --------------------------------------------------------------------

// A tap replaces one line object, so every other line answers from here and a whole-song pass stays cheap.
const factsByLine = new WeakMap<LyricLine, LineSyncFacts>();

function lineSyncFacts(line: LyricLine): LineSyncFacts {
  const splitCharacter = getSplitCharacter();
  const cached = factsByLine.get(line);
  if (cached?.splitCharacter === splitCharacter) return cached;
  const parts = splitIntoWordsWithMeta(line.text).parts;
  const slots = parts.length;
  const main = mainGap(line, parts, splitCharacter);
  const background = backgroundGap(line, splitCharacter);
  const trackGaps = [main, background].filter((gap) => gap !== null);
  const lineSynced = isLineSynced(line);
  const facts: LineSyncFacts = {
    splitCharacter,
    syncable: hasMainLyrics(line),
    timed: effectiveBounds(line) !== null,
    slots,
    timedWords: lineSynced ? slots : (main?.timedSlots ?? slots),
    fullyTimed: lineSynced || (slots > 0 && main === null),
    backgroundComplete: background === null,
    trackGaps,
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

function syncGaps(lines: readonly LyricLine[]): SyncGap[] {
  return lines.flatMap((line, lineIndex) => lineSyncFacts(line).trackGaps.map((gap) => ({ ...gap, lineIndex })));
}

function isProjectFullySynced(lines: readonly LyricLine[]): boolean {
  return lines.some(isSyncableLine) && lines.every((line) => lineSyncFacts(line).trackGaps.length === 0);
}

// -- Exports ------------------------------------------------------------------

export type { SlotRange, SyncGap, SyncGapKind, SyncGapTrack, SyncGranularity };
export {
  isLineFullyTimed,
  isLineTimed,
  isProjectFullySynced,
  isSyncableLine,
  syncGaps,
  syncProgress,
  timedWordSlotRanges,
  wordSlotCount,
};
