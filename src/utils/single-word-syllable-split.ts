import {
  leadingUntimedSeparator,
  trailingUntimedSeparator,
  withoutEdgeUntimedSeparators,
} from "@/domain/language/transliteration-format";
import type { WordTiming } from "@/domain/word/timing";
import { distributeTiming } from "@/utils/syllable-utils";
import { splitSourceWord } from "@/utils/word-timing";

// -- Types --------------------------------------------------------------------

interface SplitOneWordParams {
  word: WordTiming;
  splitPoints: number[];
  transliterationSplitPoints?: number[];
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
    const trailing = trailingUntimedSeparator(part);
    const leading = leadingUntimedSeparator(rawParts[index + 1]);
    return trailing + leading;
  });
  return {
    parts: rawParts.map(withoutEdgeUntimedSeparators),
    joiners,
  };
}

function splitWordIntoSyllables({ word, splitPoints, transliterationSplitPoints }: SplitOneWordParams): WordTiming[] {
  const { transliterationJoinerAfter: outerTransliterationJoiner, ...wordWithoutJoiner } = word;
  const partitions = distributeTiming(word.text, splitPoints, word.begin, word.end);
  const newWords = splitSourceWord(wordWithoutJoiner, partitions);
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
  if (word.sep && newWords.length > 0) {
    const last = newWords[newWords.length - 1];
    newWords[newWords.length - 1] = { ...last, sep: `${last.sep}${word.sep}` };
  }
  return newWords;
}

// -- Exports ------------------------------------------------------------------

export { splitWordIntoSyllables };
