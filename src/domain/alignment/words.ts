import { splitCjkPart } from "@/domain/alignment/cjk";
import { newWordId } from "@/domain/word/id";
import type { WordTiming } from "@/domain/word/timing";
import { splitTrailingWhitespace } from "insync/from-words";

// -- Types --------------------------------------------------------------------

/** One spoken word and the parts it's timed in: syllables, or single Chinese/Japanese characters. */
interface AlignmentWord {
  text: string;
  parts: string[];
  /** The separator after each part; a word ends after its last part. */
  seps: string[];
}

interface WordInterval {
  begin: number;
  end: number;
}

/** An unsplit part the audio shows is worth splitting into syllables. */
interface PartSplit {
  /** Index into the line's flattened parts. */
  part: number;
  /** Character offsets in the part where each later syllable starts. */
  at: number[];
  /** One interval per syllable. */
  intervals: WordInterval[];
}

// -- Constants ----------------------------------------------------------------

const MIN_PART_DURATION = 0.01;

// -- Functions ----------------------------------------------------------------

// Regroups the editor's split output (syllable parts with a trailing-space flag
// on each word's last part) into whole words, which is what the aligner's
// pronunciation lookup needs. Unspaced Chinese and Japanese is split into one
// part per character so each gets its own timing.
function groupAlignmentWords(parts: string[], trailingSpace: boolean[]): AlignmentWord[] {
  const words: AlignmentWord[] = [];
  let current: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    current.push(...splitCjkPart(parts[i]));
    const isLast = i === parts.length - 1;
    if (trailingSpace[i] || isLast) {
      const seps = current.map((_, k) => (k === current.length - 1 && trailingSpace[i] ? " " : ""));
      words.push({ text: current.join(""), parts: current, seps });
      current = [];
    }
  }
  return words;
}

// Regroups a word-synced line's timings into whole words: a word runs until a
// part stops joining the next, so hand-split syllables stay together.
function groupTimedWords(timings: readonly WordTiming[]): AlignmentWord[] {
  const words: AlignmentWord[] = [];
  let current: string[] = [];
  let seps: string[] = [];
  for (let i = 0; i < timings.length; i++) {
    current.push(timings[i].text);
    seps.push(timings[i].sep);
    if (!timings[i].joinsNext || i === timings.length - 1) {
      words.push({ text: current.join(""), parts: current, seps });
      current = [];
      seps = [];
    }
  }
  return words;
}

// Makes aligner output safe to store: ordered, non-overlapping, inside the
// line's window, and every word at least long enough to grab in the timeline.
function sanitizeIntervals(intervals: WordInterval[], bounds: WordInterval): WordInterval[] {
  const out: WordInterval[] = [];
  // A window too short for the minimum gives each part an even share of it instead.
  const minimum = Math.min(MIN_PART_DURATION, Math.max(0, bounds.end - bounds.begin) / Math.max(1, intervals.length));
  let cursor = bounds.begin;
  for (let i = 0; i < intervals.length; i++) {
    const remaining = intervals.length - i;
    const latestBegin = bounds.end - remaining * minimum;
    // The outer clamps only absorb rounding when the parts fill the window exactly.
    const begin = Math.max(cursor, Math.min(Math.max(intervals[i].begin, cursor), latestBegin));
    const nextBegin = intervals[i + 1]?.begin ?? bounds.end;
    const end = Math.min(bounds.end, Math.max(begin + minimum, Math.min(intervals[i].end, nextBegin, bounds.end)));
    out.push({ begin, end });
    cursor = end;
  }
  return out;
}

// One part's timed pieces: itself, or its syllables when the audio split it.
function partPieces(part: string, interval: WordInterval, split: PartSplit | undefined) {
  if (!split) return [{ text: part, ...interval }];
  const intervals = sanitizeIntervals(split.intervals, interval);
  return [0, ...split.at].map((start, k) => ({ text: part.slice(start, split.at[k] ?? part.length), ...intervals[k] }));
}

// Word timings for a line-timed line, one per part (or per syllable of a part
// the audio split), with each part's separator kept on its last piece and
// every piece of a split word joined to the next.
function timingsFromParts(
  words: AlignmentWord[],
  partIntervals: WordInterval[],
  splits: PartSplit[] = [],
): WordTiming[] {
  const splitOf = new Map(splits.map((split) => [split.part, split]));
  const timings: WordTiming[] = [];
  let index = 0;
  for (const { parts, seps } of words) {
    const pieces = parts.flatMap((part, p) => {
      const partPiecesOf = partPieces(part, partIntervals[index], splitOf.get(index++));
      return partPiecesOf.map((piece, k) => ({ ...piece, sep: k === partPiecesOf.length - 1 ? seps[p] : "" }));
    });
    pieces.forEach((piece, k) => {
      timings.push({
        id: newWordId(),
        ...splitTrailingWhitespace(piece.text + piece.sep),
        begin: piece.begin,
        end: piece.end,
        joinsNext: k < pieces.length - 1,
      });
    });
  }
  return timings;
}

// New times for a line that already has word timing. Everything else about each
// part (text, explicit flag, syllable group, transliteration) is kept.
function retimeWords(existing: readonly WordTiming[], partIntervals: WordInterval[]): WordTiming[] {
  return existing.map((word, i) => ({ ...word, begin: partIntervals[i].begin, end: partIntervals[i].end }));
}

// -- Exports ------------------------------------------------------------------

export { groupAlignmentWords, groupTimedWords, retimeWords, sanitizeIntervals, timingsFromParts };
export type { AlignmentWord, PartSplit, WordInterval };
