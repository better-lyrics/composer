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

function splitParts(text: string, splitPoints: number[]): { parts: string[]; joiners: string[] } {
  const points = splitPoints.toSorted((a, b) => a - b);
  let start = 0;
  const rawParts: string[] = [];
  for (const point of points) {
    if (point > start && point < text.length) {
      rawParts.push(text.slice(start, point));
      start = point;
    }
  }
  rawParts.push(text.slice(start));
  const joiners = rawParts.slice(0, -1).map((part, index) => {
    const trailing = part.match(/[-\u2010-\u2015\s]+$/)?.[0] ?? "";
    const leading = rawParts[index + 1].match(/^[-\u2010-\u2015\s]+/)?.[0] ?? "";
    return trailing + leading;
  });
  return {
    parts: rawParts.map((part) => part.replace(/^[-\u2010-\u2015\s]+|[-\u2010-\u2015\s]+$/g, "")),
    joiners,
  };
}

function splitWordIntoSyllables({
  word,
  splitPoints,
  transliterationSplitPoints,
  reuseGroupId = false,
}: SplitOneWordParams): WordTiming[] {
  const groupId = reuseGroupId && word.syllableGroupId !== undefined ? word.syllableGroupId : nanoid(8);
  const { transliterationJoinerAfter: outerTransliterationJoiner, ...wordWithoutJoiner } = word;
  const sourceForSplit: WordTiming = { ...wordWithoutJoiner, syllableGroupId: groupId };
  const trimmed = word.text.trimEnd();
  const partitions = distributeTiming(trimmed, splitPoints, word.begin, word.end);
  const newWords = splitSourceWord(sourceForSplit, partitions);
  if (word.transliteration && transliterationSplitPoints) {
    const { parts: transliterations, joiners } = splitParts(word.transliteration.trim(), transliterationSplitPoints);
    if (transliterations.length === newWords.length) {
      for (let i = 0; i < newWords.length; i++) {
        newWords[i] = {
          ...newWords[i],
          transliteration: transliterations[i],
          ...(i < joiners.length ? { transliterationJoinerAfter: joiners[i] } : {}),
        };
      }
    }
  }
  if (outerTransliterationJoiner !== undefined && newWords.length > 0) {
    const last = newWords[newWords.length - 1];
    newWords[newWords.length - 1] = { ...last, transliterationJoinerAfter: outerTransliterationJoiner };
  }
  if (word.text.endsWith(" ") && newWords.length > 0) {
    const last = newWords[newWords.length - 1];
    newWords[newWords.length - 1] = { ...last, text: `${last.text} ` };
  }
  return newWords;
}

// -- Exports ------------------------------------------------------------------

export { splitWordIntoSyllables };
