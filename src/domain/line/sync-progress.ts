import { effectiveBounds } from "insync/line-bounds";
import type { LyricLine } from "insync/line";
import { hasMainLyrics, isLineSynced } from "insync/line-predicates";
import { backgroundText, lineText } from "insync/line-text";
import { backgroundTrack, mainTrack, timedSyllables } from "insync/line-track";
import type { WordTiming } from "insync/word-timing";
import { splitIntoWordsWithMeta } from "insync/lyric-words";

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
  splitChar: string;
  syncable: boolean;
  timed: boolean;
  slots: number;
  timedWords: number;
  fullyTimed: boolean;
  backgroundComplete: boolean;
  trackGaps: readonly TrackGap[];
}

// -- Gaps ---------------------------------------------------------------------

function lettersOf(text: string, splitChar: string): string {
  return [...text].filter((char) => char.trim() !== "" && char !== splitChar).join("");
}

// A timed word spans several slots only when its letters are exactly those slots joined, so stale word text never merges slots.
function slotsCoveredBy(parts: readonly string[], slot: number, timed: WordTiming, splitChar: string): number {
  const letters = lettersOf(timed.text, splitChar);
  let joined = parts[slot];
  let end = slot + 1;
  while (joined.length < letters.length && end < parts.length && letters.startsWith(joined)) joined += parts[end++];
  return joined === letters ? end - slot : 1;
}

function slotRangesOf(parts: readonly string[], words: readonly WordTiming[], splitChar: string): SlotRange[] {
  const ranges: SlotRange[] = [];
  let slot = 0;
  for (const timed of words) {
    if (slot >= parts.length) break;
    const end = slot + slotsCoveredBy(parts, slot, timed, splitChar);
    ranges.push({ start: slot, end });
    slot = end;
  }
  return ranges;
}

function problemSlotsOf(parts: readonly string[], words: readonly WordTiming[], splitChar: string): number[] {
  const problems: number[] = [];
  const ranges = slotRangesOf(parts, words, splitChar);
  for (const { start, end } of ranges) {
    if (end - start > 1) for (let index = start; index < end; index++) problems.push(index);
  }
  for (let index = ranges.at(-1)?.end ?? 0; index < parts.length; index++) problems.push(index);
  return problems;
}

function timedWordSlotRanges(text: string, words: readonly WordTiming[], splitChar: string): SlotRange[] {
  return slotRangesOf(splitIntoWordsWithMeta(text, splitChar).parts, words, splitChar);
}

function trackGap(
  lineId: string,
  track: SyncGapTrack,
  parts: readonly string[],
  words: readonly WordTiming[],
  splitChar: string,
): TrackGap | null {
  const slotCount = parts.length;
  if (words.length === 0) return { lineId, track, kind: "untimed", timedSlots: 0, slotCount, problemSlots: [] };
  const problemSlots = problemSlotsOf(parts, words, splitChar);
  if (problemSlots.length === 0) return null;
  return { lineId, track, kind: "partial", timedSlots: slotCount - problemSlots.length, slotCount, problemSlots };
}

function backgroundGap(line: LyricLine, splitChar: string): TrackGap | null {
  const bgText = backgroundText(line, splitChar) ?? "";
  if (!bgText.trim()) return null;
  const parts = splitIntoWordsWithMeta(bgText, splitChar).parts;
  const backgroundWords = timedSyllables(backgroundTrack(line));
  if (!hasMainLyrics(line, splitChar)) {
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
  return trackGap(line.id, "background", parts, backgroundWords, splitChar);
}

function mainGap(line: LyricLine, parts: readonly string[], splitChar: string): TrackGap | null {
  if (!hasMainLyrics(line, splitChar) || isLineSynced(line)) return null;
  return trackGap(line.id, "main", parts, timedSyllables(mainTrack(line)), splitChar);
}

// -- Cache --------------------------------------------------------------------

// A tap replaces one line object, so every other line answers from here and a whole-song pass stays cheap.
const factsByLine = new WeakMap<LyricLine, LineSyncFacts>();

function lineSyncFacts(line: LyricLine, splitChar: string): LineSyncFacts {
  const cached = factsByLine.get(line);
  if (cached?.splitChar === splitChar) return cached;
  const parts = splitIntoWordsWithMeta(lineText(line, splitChar), splitChar).parts;
  const slots = parts.length;
  const main = mainGap(line, parts, splitChar);
  const background = backgroundGap(line, splitChar);
  const trackGaps = [main, background].filter((gap) => gap !== null);
  const lineSynced = isLineSynced(line);
  const facts: LineSyncFacts = {
    splitChar,
    syncable: hasMainLyrics(line, splitChar),
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

function isSyncableLine(line: LyricLine | undefined, splitChar: string): line is LyricLine {
  return !!line && lineSyncFacts(line, splitChar).syncable;
}

function isLineTimed(line: LyricLine, splitChar: string): boolean {
  return lineSyncFacts(line, splitChar).timed;
}

function wordSlotCount(line: LyricLine, splitChar: string): number {
  return lineSyncFacts(line, splitChar).slots;
}

function isLineFullyTimed(line: LyricLine, splitChar: string): boolean {
  return lineSyncFacts(line, splitChar).fullyTimed;
}

// -- Aggregates ---------------------------------------------------------------

function syncProgress(lines: readonly LyricLine[], granularity: SyncGranularity, splitChar: string): SyncProgress {
  let done = 0;
  let total = 0;
  for (const line of lines) {
    const facts = lineSyncFacts(line, splitChar);
    if (!facts.syncable) continue;
    total += granularity === "line" ? 1 : facts.slots;
    if (granularity === "word") done += facts.timedWords;
    else if (facts.timed) done += 1;
  }
  return { done, total };
}

function fullySyncedLineCount(lines: readonly LyricLine[], splitChar: string): number {
  let count = 0;
  for (const line of lines)
    if (isSyncableLine(line, splitChar) && lineSyncFacts(line, splitChar).trackGaps.length === 0) count += 1;
  return count;
}

function syncGaps(lines: readonly LyricLine[], splitChar: string): SyncGap[] {
  return lines.flatMap((line, lineIndex) =>
    lineSyncFacts(line, splitChar).trackGaps.map((gap) => ({ ...gap, lineIndex })),
  );
}

function isProjectFullySynced(lines: readonly LyricLine[], splitChar: string): boolean {
  return (
    lines.some((value) => isSyncableLine(value, splitChar)) &&
    lines.every((line) => lineSyncFacts(line, splitChar).trackGaps.length === 0)
  );
}

// -- Exports ------------------------------------------------------------------

export type { SyncGap, SyncGapTrack, SyncGranularity };
export {
  fullySyncedLineCount,
  isLineFullyTimed,
  isLineTimed,
  isProjectFullySynced,
  isSyncableLine,
  syncGaps,
  syncProgress,
  timedWordSlotRanges,
  wordSlotCount,
};
