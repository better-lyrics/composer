import { splitCjkPart } from "@/domain/alignment/cjk";
import type { WordTiming } from "@/domain/word/timing";

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
  let cursor = bounds.begin;
  for (let i = 0; i < intervals.length; i++) {
    const remaining = intervals.length - i;
    const latestBegin = bounds.end - remaining * MIN_PART_DURATION;
    const begin = Math.min(Math.max(intervals[i].begin, cursor), latestBegin);
    const nextBegin = intervals[i + 1]?.begin ?? bounds.end;
    const end = Math.max(begin + MIN_PART_DURATION, Math.min(intervals[i].end, nextBegin, bounds.end));
    out.push({ begin, end });
    cursor = end;
  }
  return out;
}

// Word timings for a line-timed line, one per part, with the space after each
// word kept on its last part.
function timingsFromParts(words: AlignmentWord[], partIntervals: WordInterval[]): WordTiming[] {
  const timings: WordTiming[] = [];
  for (const { parts, trailingSpace } of words) {
    parts.forEach((part, p) => {
      const { begin, end } = partIntervals[timings.length];
      timings.push({ text: p === parts.length - 1 && trailingSpace ? `${part} ` : part, begin, end });
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
export type { AlignmentWord, WordInterval };
