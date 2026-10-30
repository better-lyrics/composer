import type { AlignmentSegment } from "@/audio/alignment/types";
import { hasCjk } from "@/domain/alignment/cjk";
import { type HanReading, hanReadingFor } from "@/domain/alignment/language";
import { sungTransliteration } from "@/domain/alignment/transliteration";
import { alignmentWindow, backgroundWindow, sliceWindow } from "@/domain/alignment/window";
import { groupAlignmentWords, groupTimedWords, type AlignmentWord, type WordInterval } from "@/domain/alignment/words";
import type { LinkGroup } from "@/domain/group/template";
import { sharedTimingFanOut } from "@/domain/group/shared-timing";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import { bgBounds, mainBounds } from "@/domain/line/bounds";
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
  /** Background vocals aligned as jobs of their own, whether or not the run re-aligns. */
  background: number;
  /** Lines with any of the above. */
  lines: number;
}

/** One aligner job: a line's lyrics, or its background vocals as a job of their own. */
interface PlannedLine {
  line: LyricLine;
  track: WordTrack;
  taps: WordInterval;
  words: AlignmentWord[];
  /** The track's current word timing when re-aligning; its parts are kept and retimed. */
  existing: WordTiming[] | null;
  previous: WordInterval | null;
  /** The line just before, when it has timing: the only line this one may anchor on. Null for background vocals. */
  previousId: string | null;
  /**
   * The span the line's windows are built around: its taps, or for a line
   * tapped in Line mode that no tap ended (the last one, or one a jump left
   * behind), from its begin to the next line's, or on to the song's end.
   * Background vocals have no tap, so theirs is their whole window.
   */
  guide: WordInterval;
}

/** One track of one line, as picked in the Timeline. */
interface AlignTarget {
  lineId: string;
  track: WordTrack;
}

/** A job's new word timing. */
interface AlignedJob {
  plan: PlannedLine;
  words: WordTiming[];
}

type TrackPlan = Pick<PlannedLine, "taps" | "words" | "existing" | "guide">;

// -- Functions ----------------------------------------------------------------

// A Line mode tap opens a line at end == begin and the next tap closes it there; the last line, and the
// line before a jump, are never closed.
function planLine(line: LyricLine, realign: boolean, nextBegin: number): TrackPlan | null {
  if (isLineSynced(line)) {
    const end = line.end === line.begin ? nextBegin : line.end;
    if (end <= line.begin) return null;
    const { parts, trailingSpace } = splitIntoWordsWithMeta(line.text);
    if (parts.length === 0) return null;
    return {
      taps: { begin: line.begin, end: line.end },
      words: groupAlignmentWords(parts, trailingSpace),
      existing: null,
      guide: { begin: line.begin, end },
    };
  }
  if (realign && isWordSynced(line)) {
    const taps = mainBounds(line);
    if (!taps || taps.end <= taps.begin) return null;
    return { taps, words: groupTimedWords(line.words!), existing: line.words!, guide: taps };
  }
  return null;
}

// A whole-song run aligns background vocals with their line, since tapping a
// line seeds them with a guess; re-aligning also redoes timed ones whose line
// isn't aligned. A Timeline pick aligns them whatever the line's timing.
function planBackground(line: LyricLine, span: WordInterval | null, neighbours: Neighbours): TrackPlan | null {
  if (!line.backgroundText || !span || span.end < span.begin) return null;
  const guide = backgroundWindow(span, neighbours);
  const existing = line.backgroundWords?.length ? line.backgroundWords : null;
  if (existing) return { taps: guide, words: groupTimedWords(existing), existing, guide };
  const { parts, trailingSpace } = splitIntoWordsWithMeta(line.backgroundText);
  return parts.length > 0
    ? { taps: guide, words: groupAlignmentWords(parts, trailingSpace), existing: null, guide }
    : null;
}

type Neighbours = Parameters<typeof backgroundWindow>[1];

/** Every line's lyrics and background vocals, or only the targeted tracks. */
function planLines(lines: readonly LyricLine[], targets: readonly AlignTarget[] | undefined, realign: boolean) {
  const wanted = targets ? new Map<string, WordTrack[]>() : null;
  for (const { lineId, track } of targets ?? []) wanted!.set(lineId, [...(wanted!.get(lineId) ?? []), track]);
  const bounds = lines.map((line) => mainBounds(line));
  const nextBegin: number[] = new Array(lines.length);
  let next = Number.POSITIVE_INFINITY;
  for (let i = lines.length - 1; i >= 0; i--) {
    nextBegin[i] = next;
    if (bounds[i]) next = bounds[i]!.begin;
  }
  // Each line's sung span, with an unclosed Line mode line running to the next tap.
  const spans = lines.map((line, i) => {
    const own = bounds[i];
    if (!own) return bgBounds(line);
    const end = own.end === own.begin ? nextBegin[i] : own.end;
    return Number.isFinite(end) ? { begin: own.begin, end } : own;
  });
  const planned: PlannedLine[] = [];
  let previous: WordInterval | null = null;
  let previousSpan: WordInterval | null = null;
  lines.forEach((line, i) => {
    const tracks = wanted?.get(line.id);
    const plan = !wanted || tracks?.includes("word") ? planLine(line, realign, nextBegin[i]) : null;
    const previousId = i > 0 && bounds[i - 1] ? lines[i - 1].id : null;
    if (plan) planned.push({ line, track: "word", ...plan, previous, previousId });
    const withLine = wanted ? !!tracks?.includes("bg") : plan !== null || (realign && !!line.backgroundWords?.length);
    // The last line, which nothing closed, gives no end to run to.
    const after = spans.slice(i + 1).find((span) => span !== null);
    const neighbours = { previous: previousSpan, next: after && after.end > after.begin ? after : null };
    const background = withLine ? planBackground(line, spans[i], neighbours) : null;
    if (background) planned.push({ line, track: "bg", ...background, previous: null, previousId: null });
    if (bounds[i]) previous = bounds[i];
    if (spans[i]) previousSpan = spans[i];
  });
  return planned;
}

/** The lyrics of the given lines, re-aligned. */
function planLyrics(lines: readonly LyricLine[], lineIds: readonly string[]): PlannedLine[] {
  return planLines(
    lines,
    lineIds.map((lineId) => ({ lineId, track: "word" }) as const),
    true,
  );
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
  const main = all.filter((p) => p.track === "word");
  const lineTimed = main.filter((p) => p.existing === null).length;
  const count = new Set(all.map((p) => p.line.id)).size;
  return { lineTimed, wordTimed: main.length - lineTimed, background: all.length - main.length, lines: count };
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

/** The span a planned line's windows are built around, inside the song. */
function guideTaps(plan: PlannedLine, duration: number): WordInterval {
  return { begin: plan.guide.begin, end: Math.min(plan.guide.end, duration) };
}

/** The aligner's input for one planned line: the song's vocals in `window`. */
function segmentIn(
  plan: PlannedLine,
  hanReading: HanReading,
  pcm: { samples: Float32Array; sampleRate: number },
  window: WordInterval,
  anchor?: string[],
): AlignmentSegment {
  return {
    words: plan.words,
    hanReading,
    transliteration: sungTransliteration(plan.line, plan.track),
    taps: guideTaps(plan, pcm.samples.length / pcm.sampleRate),
    windowBegin: window.begin,
    samples: sliceWindow(pcm.samples, pcm.sampleRate, window),
    sampleRate: pcm.sampleRate,
    ...(anchor ? { anchor } : {}),
  };
}

/** The window a line is aligned in without the CTC search or an anchor. */
function plainWindow(plan: PlannedLine, duration: number): WordInterval {
  return alignmentWindow(guideTaps(plan, duration), { duration, previous: plan.previous });
}

/** The aligner's input for one planned line in its plain window, and that window. */
function segmentFor(
  plan: PlannedLine,
  hanReading: HanReading,
  pcm: { samples: Float32Array; sampleRate: number },
): { segment: AlignmentSegment; window: WordInterval } {
  const window = plainWindow(plan, pcm.samples.length / pcm.sampleRate);
  return { segment: segmentIn(plan, hanReading, pcm, window), window };
}

/** False for a line Line mode never ended, which is aligned up to the next line instead. */
function hasTappedEnd(plan: PlannedLine): boolean {
  return plan.guide.end === plan.taps.end;
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

/**
 * How the run reads Han characters, and whether any job needs the kanji
 * dictionary: lyrics or background vocals with Han read as Japanese.
 */
function readingsFor(
  project: { metadata: { language?: string }; lines: readonly LyricLine[] },
  planned: readonly PlannedLine[],
): { hanReading: HanReading; japanese: boolean } {
  const hanReading = hanReadingFor(project.metadata.language, project.lines);
  const text = (plan: PlannedLine) => (plan.track === "bg" ? (plan.line.backgroundText ?? "") : plan.line.text);
  return { hanReading, japanese: hanReading === "ja" && planned.some((plan) => hasCjk(text(plan))) };
}

/** One update per line, so its lyrics and background vocals land together. */
function lineUpdatesFrom(jobs: readonly AlignedJob[]): LineUpdate[] {
  const byId = new Map<string, Partial<LyricLine>>();
  for (const { plan, words } of jobs) {
    byId.set(plan.line.id, { ...byId.get(plan.line.id), [trackField(plan.track)]: words });
  }
  return [...byId].map(([id, updates]) => ({ id, updates }));
}

// -- Exports ------------------------------------------------------------------

export type { AlignedJob, AlignTarget, PlannedLine };
export {
  alignTargetsOf,
  countAlignableLines,
  guideTaps,
  hasTappedEnd,
  isUnchanged,
  lineUpdatesFrom,
  plainWindow,
  planLines,
  planLyrics,
  readingsFor,
  segmentFor,
  segmentIn,
  withSharedTiming,
};
