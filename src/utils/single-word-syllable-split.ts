import type { LanguagePiece } from "@/domain/language/model";
import type { PositionalPieces } from "@/domain/language/pieces";
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

function splitWordIntoSyllables({ word, splitPoints }: SplitOneWordParams): WordTiming[] {
  const partitions = distributeTiming(word.text, splitPoints, word.begin, word.end);
  const newWords = splitSourceWord(word, partitions);
  if (word.sep && newWords.length > 0) {
    const last = newWords[newWords.length - 1];
    newWords[newWords.length - 1] = { ...last, sep: `${last.sep}${word.sep}` };
  }
  return newWords;
}

function splitSyllablePieces(
  piece: LanguagePiece | undefined,
  transliterationSplitPoints: number[] | undefined,
  count: number,
): PositionalPieces | undefined {
  if (count === 0) return undefined;
  const pieces: (LanguagePiece | undefined)[] = new Array(count).fill(undefined);
  if (piece?.text && transliterationSplitPoints) {
    const { parts, joiners } = splitParts(piece.text.trim(), transliterationSplitPoints);
    if (parts.length === count) {
      for (let i = 0; i < count; i++) {
        pieces[i] = { text: parts[i], ...(i < joiners.length ? { joinerAfter: joiners[i] } : {}) };
      }
    }
  }
  if (piece?.joinerAfter !== undefined) pieces[count - 1] = { ...pieces[count - 1], joinerAfter: piece.joinerAfter };
  return pieces.some(Boolean) ? pieces : undefined;
}

// -- Exports ------------------------------------------------------------------

export { splitSyllablePieces, splitWordIntoSyllables };
