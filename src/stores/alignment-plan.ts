import type { AlignmentSegment } from "@/audio/alignment/types";
import type { HanReading } from "@/domain/alignment/language";
import { sungTransliteration } from "@/domain/alignment/transliteration";
import { alignmentWindow, sliceWindow } from "@/domain/alignment/window";
import { groupAlignmentWords, groupTimedWords, type AlignmentWord, type WordInterval } from "@/domain/alignment/words";
import type { LinkGroup } from "@/domain/group/template";
import { sharedTimingFanOut } from "@/domain/group/shared-timing";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import { mainBounds } from "@/domain/line/bounds";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
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

interface PlannedLine {
  line: LyricLine;
  taps: WordInterval;
  words: AlignmentWord[];
  /** The line's current word timing when re-aligning; its parts are kept and retimed. */
  existing: WordTiming[] | null;
  previous: WordInterval | null;
  /** The line just before, when it has timing: the only line this one may anchor on. */
  previousId: string | null;
  /**
   * The span the line's windows are built around: its taps, or for a line
   * tapped in Line mode that no tap ended (the last one, or one a jump left
   * behind), from its begin to the next line's, or on to the song's end.
   */
  guide: WordInterval;
}

// -- Functions ----------------------------------------------------------------

// A Line mode tap opens a line at end == begin and the next tap closes it there; the last line, and the
// line before a jump, are never closed.
function planLine(
  line: LyricLine,
  realign: boolean,
  nextBegin: number,
): Pick<PlannedLine, "taps" | "words" | "existing" | "guide"> | null {
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

function planLines(lines: readonly LyricLine[], lineIds: readonly string[] | undefined, realign: boolean) {
  const wanted = lineIds ? new Set(lineIds) : null;
  const bounds = lines.map((line) => mainBounds(line));
  const nextBegin: number[] = new Array(lines.length);
  let next = Number.POSITIVE_INFINITY;
  for (let i = lines.length - 1; i >= 0; i--) {
    nextBegin[i] = next;
    if (bounds[i]) next = bounds[i]!.begin;
  }
  const planned: PlannedLine[] = [];
  let previous: WordInterval | null = null;
  lines.forEach((line, i) => {
    const plan = !wanted || wanted.has(line.id) ? planLine(line, realign, nextBegin[i]) : null;
    const previousId = i > 0 && bounds[i - 1] ? lines[i - 1].id : null;
    if (plan) planned.push({ line, ...plan, previous, previousId });
    if (bounds[i]) previous = bounds[i];
  });
  return planned;
}

function countAlignableLines(lines: readonly LyricLine[], lineIds?: readonly string[]): AlignableCounts {
  const all = planLines(lines, lineIds, true);
  const lineTimed = all.filter((p) => p.existing === null).length;
  return { lineTimed, wordTimed: all.length - lineTimed };
}

// A line the user retimed or retyped mid-run keeps their edit. The store
// replaces a line's object (and its words array) on every change.
function isUnchanged(current: LyricLine | undefined, planned: PlannedLine): boolean {
  if (!current || current.text !== planned.line.text) return false;
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
    transliteration: sungTransliteration(plan.line),
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

// -- Exports ------------------------------------------------------------------

export {
  countAlignableLines,
  guideTaps,
  hasTappedEnd,
  isUnchanged,
  planLines,
  plainWindow,
  segmentFor,
  segmentIn,
  withSharedTiming,
};
export type { PlannedLine };
