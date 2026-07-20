import type { WordTiming } from "@/domain/word/timing";
import { distributeTiming } from "@/utils/syllable-utils";
import { splitSourceWord } from "@/utils/word-timing";
import { nanoid } from "nanoid";

// -- Types --------------------------------------------------------------------

interface SplitOneWordParams {
  word: WordTiming;
  splitPoints: number[];
  transliterationSplitPoints?: number[];
  reuseGroupId?: boolean;
}

// -- Helpers ------------------------------------------------------------------

function splitParts(text: string, splitPoints: number[]): string[] {
  const points = splitPoints.toSorted((a, b) => a - b);
  let start = 0;
  const parts: string[] = [];
  for (const point of points) {
    if (point > start && point < text.length) {
      parts.push(text.slice(start, point));
      start = point;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.replace(/^[-\u2010-\u2015\s]+|[-\u2010-\u2015\s]+$/g, ""));
}

function splitWordIntoSyllables({
  word,
  splitPoints,
  transliterationSplitPoints,
  reuseGroupId = false,
}: SplitOneWordParams): WordTiming[] {
  const groupId = reuseGroupId && word.syllableGroupId !== undefined ? word.syllableGroupId : nanoid(8);
  const sourceForSplit: WordTiming = { ...word, syllableGroupId: groupId };
  const trimmed = word.text.trimEnd();
  const partitions = distributeTiming(trimmed, splitPoints, word.begin, word.end);
  const newWords = splitSourceWord(sourceForSplit, partitions);
  if (word.transliteration && transliterationSplitPoints) {
    const transliterations = splitParts(word.transliteration.trim(), transliterationSplitPoints);
    if (transliterations.length === newWords.length) {
      for (let i = 0; i < newWords.length; i++) newWords[i] = { ...newWords[i], transliteration: transliterations[i] };
    }
  }
  if (word.text.endsWith(" ") && newWords.length > 0) {
    const last = newWords[newWords.length - 1];
    newWords[newWords.length - 1] = { ...last, text: `${last.text} ` };
  }
  return newWords;
}

// -- Exports ------------------------------------------------------------------

export { splitWordIntoSyllables };
