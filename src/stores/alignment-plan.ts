import { groupAlignmentWords, groupTimedWords, type AlignmentWord, type WordInterval } from "@/domain/alignment/words";
import { mainBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
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
}

// -- Functions ----------------------------------------------------------------

function planLine(line: LyricLine, realign: boolean): Pick<PlannedLine, "taps" | "words" | "existing"> | null {
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

function planLines(lines: readonly LyricLine[], lineIds: readonly string[] | undefined, realign: boolean) {
  const wanted = lineIds ? new Set(lineIds) : null;
  const planned: PlannedLine[] = [];
  let previous: WordInterval | null = null;
  for (const line of lines) {
    const bounds = mainBounds(line);
    const plan = !wanted || wanted.has(line.id) ? planLine(line, realign) : null;
    if (plan) planned.push({ line, ...plan, previous });
    if (bounds) previous = bounds;
  }
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

// -- Exports ------------------------------------------------------------------

export { countAlignableLines, isUnchanged, planLine, planLines };
export type { PlannedLine };
