import type { AlignmentSegment } from "@/audio/alignment/types";
import type { HanReading } from "@/domain/alignment/language";
import { sungTransliteration } from "@/domain/alignment/transliteration";
import { DEFAULT_WINDOW_OPTIONS, alignmentWindow, sliceWindow } from "@/domain/alignment/window";
import { groupAlignmentWords, groupTimedWords, type AlignmentWord, type WordInterval } from "@/domain/alignment/words";
import type { LinkGroup } from "@/domain/group/template";
import { sharedTimingFanOut } from "@/domain/group/shared-timing";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import { bgBounds, effectiveBounds, mainBounds } from "@/domain/line/bounds";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { type WordTrack, trackField } from "@/domain/line/tracks";
import type { WordTiming } from "@/domain/word/timing";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// Which lines a run aligns, and what each one is aligned against.

// -- Types --------------------------------------------------------------------

interface AlignableCounts {
  /** Lines with only line timing: what a first run aligns. */
  lineTimed: number;
  /** Lines that already have word timing: only aligned when re-aligning. */
  wordTimed: number;
}

/** One aligner job: a line's lyrics, or its background vocals as a job of their own. */
interface PlannedLine {
  line: LyricLine;
  track: WordTrack;
  /** What this job aligns: the line's text or its background text. */
  text: string;
  taps: WordInterval;
  words: AlignmentWord[];
  /** The line's current word timing when re-aligning; its parts are kept and retimed. */
  existing: WordTiming[] | null;
  previous: WordInterval | null;
}

/** One track of one line, as picked in the Timeline. */
interface AlignTarget {
  lineId: string;
  track: WordTrack;
}

interface AlignedJob {
  plan: PlannedLine;
  words: WordTiming[];
}

type TrackPlan = Pick<PlannedLine, "taps" | "words" | "existing">;

// -- Functions ----------------------------------------------------------------

function planLine(line: LyricLine, realign: boolean): TrackPlan | null {
  if (isLineSynced(line)) {
    if (line.end <= line.begin) return null;
    const { parts, trailingSpace } = splitIntoWordsWithMeta(line.text);
    if (parts.length === 0) return null;
    return {
      taps: { begin: line.begin, end: line.end },
      words: groupAlignmentWords(parts, trailingSpace),
      existing: null,
    };
  }
  if (realign && isWordSynced(line)) {
    const taps = mainBounds(line);
    if (!taps || taps.end <= taps.begin) return null;
    return { taps, words: groupTimedWords(line.words!), existing: line.words! };
  }
  return null;
}

// Background vocals picked on their own are guided by their own span only.
function planBackgroundTrack(line: LyricLine, realign: boolean): TrackPlan | null {
  const taps = bgBounds(line);
  if (!realign || !line.backgroundText || !taps || taps.end <= taps.begin) return null;
  return { taps, words: groupTimedWords(line.backgroundWords!), existing: line.backgroundWords! };
}

// In a whole-song run, background vocals go with their line: tapping a line
// seeds them with a guess, so they're aligned whenever the line is.
// Re-aligning also redoes timed background vocals on their own, including on
// lines with no lyrics. They're guided by the whole line, since the seed only
// guesses where they are.
function planBackground(line: LyricLine, mainPlanned: boolean, realign: boolean): TrackPlan | null {
  const existing = line.backgroundWords?.length ? line.backgroundWords : null;
  if (!line.backgroundText || !(mainPlanned || (realign && existing))) return null;
  const taps = effectiveBounds(line) ?? bgBounds(line);
  if (!taps || taps.end <= taps.begin) return null;
  if (existing) return { taps, words: groupTimedWords(existing), existing };
  const { parts, trailingSpace } = splitIntoWordsWithMeta(line.backgroundText);
  return parts.length > 0 ? { taps, words: groupAlignmentWords(parts, trailingSpace), existing: null } : null;
}

/** Every line's lyrics and background vocals, or only the targeted tracks. */
function planLines(lines: readonly LyricLine[], targets: readonly AlignTarget[] | undefined, realign: boolean) {
  const wanted = targets ? new Map<string, WordTrack[]>() : null;
  for (const { lineId, track } of targets ?? []) wanted!.set(lineId, [...(wanted!.get(lineId) ?? []), track]);
  const planned: PlannedLine[] = [];
  let previous: WordInterval | null = null;
  let previousBg: WordInterval | null = null;
  for (const line of lines) {
    const tracks = wanted?.get(line.id);
    const main = !wanted || tracks?.includes("word") ? planLine(line, realign) : null;
    const background = !wanted
      ? planBackground(line, main !== null, realign)
      : tracks?.includes("bg")
        ? planBackgroundTrack(line, realign)
        : null;
    if (main) planned.push({ line, track: "word", text: line.text, ...main, previous });
    if (background) {
      const before = wanted ? previousBg : previous;
      planned.push({ line, track: "bg", text: line.backgroundText!, ...background, previous: before });
    }
    previous = mainBounds(line) ?? previous;
    previousBg = bgBounds(line) ?? previousBg;
  }
  return planned;
}

/** The tracks of the picked words, once each. */
function alignTargetsOf(words: readonly { lineId: string; type: WordTrack }[]): AlignTarget[] {
  const seen = new Set<string>();
  return words.flatMap(({ lineId, type }) => {
    const key = `${lineId}:${type}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ lineId, track: type }];
  });
}

function countAlignableLines(lines: readonly LyricLine[], targets?: readonly AlignTarget[]): AlignableCounts {
  const all = planLines(lines, targets, true);
  const lineTimed = all.filter((p) => p.track === "word" && p.existing === null).length;
  return { lineTimed, wordTimed: new Set(all.map((p) => p.line.id)).size - lineTimed };
}

// A line the user retimed or retyped mid-run keeps their edit. The store
// replaces a line's object (and its words arrays) on every change.
function isUnchanged(current: LyricLine | undefined, planned: PlannedLine): boolean {
  if (!current || current.text !== planned.line.text) return false;
  if (planned.track === "bg") {
    // The line's own timing set the window too.
    const { line } = planned;
    return (
      current.backgroundText === line.backgroundText &&
      current.backgroundWords === line.backgroundWords &&
      current.words === line.words &&
      current.begin === line.begin &&
      current.end === line.end
    );
  }
  if (planned.existing) return current.words === planned.existing;
  return isLineSynced(current) && current.begin === planned.taps.begin && current.end === planned.taps.end;
}

/** The aligner's input for one planned line, cut from the song's vocals, and the window it was cut from. */
function segmentFor(
  plan: PlannedLine,
  hanReading: HanReading,
  pcm: { samples: Float32Array; sampleRate: number },
): { segment: AlignmentSegment; window: WordInterval } {
  const duration = pcm.samples.length / pcm.sampleRate;
  const window = alignmentWindow(plan.taps, { ...DEFAULT_WINDOW_OPTIONS, duration, previous: plan.previous });
  const segment: AlignmentSegment = {
    words: plan.words,
    hanReading,
    transliteration: sungTransliteration(plan.line, plan.track),
    taps: plan.taps,
    windowBegin: window.begin,
    samples: sliceWindow(pcm.samples, pcm.sampleRate, window),
    sampleRate: pcm.sampleRate,
  };
  return { segment, window };
}

/**
 * The updates with their timing copied to linked instances that share it, as
 * every timing write does: the first instance's timing wins, so an instance
 * aligned on its own (or one whose alignment fell back) can't drift from it.
 * Null when the copy is refused.
 */
function withSharedTiming(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  updates: readonly LineUpdate[],
): LineUpdate[] | null {
  const after = applyLineUpdates(lines, updates);
  const shared = sharedTimingFanOut(
    lines,
    after,
    groups,
    updates.map((u) => u.id),
  );
  if (shared.rejected) return null;
  return shared.lines.flatMap((line, i) => (line === lines[i] ? [] : [{ id: line.id, updates: line }]));
}

/** One update per line, so its lyrics and background vocals land together. */
function lineUpdatesFrom(jobs: readonly AlignedJob[]): LineUpdate[] {
  const byId = new Map<string, Partial<LyricLine>>();
  for (const { plan, words } of jobs) {
    byId.set(plan.line.id, { ...byId.get(plan.line.id), [trackField(plan.track)]: words });
  }
  return [...byId].map(([id, updates]) => ({ id, updates }));
}

function countLines(jobs: readonly { line: LyricLine }[]): number {
  return new Set(jobs.map((job) => job.line.id)).size;
}

// -- Exports ------------------------------------------------------------------

export type { AlignedJob, AlignTarget };
export {
  alignTargetsOf,
  countAlignableLines,
  countLines,
  isUnchanged,
  lineUpdatesFrom,
  planLine,
  planLines,
  segmentFor,
  withSharedTiming,
};
