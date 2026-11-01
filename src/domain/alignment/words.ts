import { splitCjkPart } from "@/domain/alignment/cjk";
import type { WordTiming } from "@/domain/word/timing";
import { nanoid } from "nanoid";

// -- Types --------------------------------------------------------------------

/** One spoken word and the parts it's timed in: syllables, or single Chinese/Japanese characters. */
interface AlignmentWord {
  text: string;
  parts: string[];
  trailingSpace: boolean;
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
      words.push({ text: current.join(""), parts: current, trailingSpace: trailingSpace[i] ?? false });
      current = [];
    }
  }
  return words;
}

// Regroups a word-synced line's timings into whole words: a word runs until a
// part ends with a space, so hand-split syllables stay together.
function groupTimedWords(timings: readonly WordTiming[]): AlignmentWord[] {
  const words: AlignmentWord[] = [];
  let current: string[] = [];
  for (let i = 0; i < timings.length; i++) {
    const text = timings[i].text;
    current.push(text.trimEnd());
    const trailingSpace = /\s$/.test(text);
    if (trailingSpace || i === timings.length - 1) {
      words.push({ text: current.join(""), parts: current, trailingSpace });
      current = [];
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
// the audio split), with the space after each word kept on its last piece.
// Every split word gets its own syllable group: a line groups syllables by id
// as soon as any word has one, so a word without one would come apart.
function timingsFromParts(
  words: AlignmentWord[],
  partIntervals: WordInterval[],
  splits: PartSplit[] = [],
): WordTiming[] {
  const splitOf = new Map(splits.map((split) => [split.part, split]));
  const timings: WordTiming[] = [];
  let index = 0;
  for (const { parts, trailingSpace } of words) {
    const pieces = parts.flatMap((part) => partPieces(part, partIntervals[index], splitOf.get(index++)));
    const groupId = pieces.length > 1 ? nanoid(8) : undefined;
    pieces.forEach((piece, k) => {
      const text = k === pieces.length - 1 && trailingSpace ? `${piece.text} ` : piece.text;
      timings.push({ text, begin: piece.begin, end: piece.end, ...(groupId ? { syllableGroupId: groupId } : {}) });
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
