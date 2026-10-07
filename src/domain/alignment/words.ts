import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

/** One spoken word: the syllable parts the editor shows, joined for the aligner. */
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
// pronunciation lookup needs.
function groupAlignmentWords(parts: string[], trailingSpace: boolean[]): AlignmentWord[] {
  const words: AlignmentWord[] = [];
  let current: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    current.push(parts[i]);
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

// Splits each aligned word across its syllable parts by character count, the
// same rule the editor uses when a word is split by hand.
function wordTimingsFromAlignment(words: AlignmentWord[], intervals: WordInterval[]): WordTiming[] {
  const timings: WordTiming[] = [];
  for (let w = 0; w < words.length; w++) {
    const { parts, trailingSpace } = words[w];
    const { begin, end } = intervals[w];
    const totalChars = parts.reduce((sum, part) => sum + part.length, 0) || 1;
    let at = begin;
    for (let p = 0; p < parts.length; p++) {
      const isLastPart = p === parts.length - 1;
      const partEnd = isLastPart ? end : at + ((end - begin) * parts[p].length) / totalChars;
      timings.push({ text: isLastPart && trailingSpace ? `${parts[p]} ` : parts[p], begin: at, end: partEnd });
      at = partEnd;
    }
  }
  return timings;
}

// New times for a line that already has word timing. Everything else about each
// part (text, explicit flag, syllable group, transliteration) is kept.
function retimeWords(existing: readonly WordTiming[], words: AlignmentWord[], intervals: WordInterval[]): WordTiming[] {
  const fresh = wordTimingsFromAlignment(words, intervals);
  return existing.map((word, i) => ({ ...word, begin: fresh[i].begin, end: fresh[i].end }));
}

// -- Exports ------------------------------------------------------------------

export { groupAlignmentWords, groupTimedWords, retimeWords, sanitizeIntervals, wordTimingsFromAlignment };
export type { AlignmentWord, WordInterval };
