import type { WordTiming } from "./word-timing";
import { wordsFromSpaced } from "./word-spaced-words";
import { textParts } from "./word-text-parts";

// -- Constants ----------------------------------------------------------------

const DEFAULT_BG_WORD_DURATION = 0.3;

// -- Functions ----------------------------------------------------------------

function splitIntoWords(text: string, splitChar: string): string[] {
  return splitIntoWordsWithMeta(text, splitChar).parts;
}

function splitIntoWordsWithMeta(text: string, splitChar: string): { parts: string[]; trailingSpace: boolean[] } {
  const parts = textParts(text, splitChar);
  return {
    parts: parts.map((part) => part.text),
    trailingSpace: parts.map((part, index) => part.sep !== "" && index < parts.length - 1),
  };
}

// Evenly timed parts of a text, as a line-synced line's span becomes words.
function evenlyTimedWords(text: string, begin: number, end: number, splitChar: string): WordTiming[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text, splitChar);
  const wordDuration = (end - begin) / parts.length;
  return wordsFromSpaced(
    parts.map((part, i) => ({
      text: trailingSpace[i] ? `${part} ` : part,
      begin: begin + i * wordDuration,
      end: begin + (i + 1) * wordDuration,
    })),
  );
}

// -- Word Distribution --------------------------------------------------------

function distributeWordsInLine(text: string, begin: number, end: number, splitChar: string): WordTiming[] {
  const { parts: words, trailingSpace } = splitIntoWordsWithMeta(text, splitChar);
  if (words.length === 0) return [];

  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const duration = end - begin;

  let currentTime = begin;
  return wordsFromSpaced(
    words.map((word, i) => {
      const wordDuration = (word.length / totalChars) * duration;
      const wordTiming = {
        text: trailingSpace[i] ? `${word} ` : word,
        begin: currentTime,
        end: currentTime + wordDuration,
      };
      currentTime += wordDuration;
      return wordTiming;
    }),
  );
}

// -- BG Word Creation ---------------------------------------------------------

function createInitialBgWords(
  backgroundText: string,
  begin: number,
  end: number | undefined,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): WordTiming[] {
  const wordCount = splitIntoWords(backgroundText, splitChar).length;
  if (wordCount === 0) return [];
  const resolvedEnd = end ?? Math.max(begin, Math.min(begin + wordCount * DEFAULT_BG_WORD_DURATION, songEnd));
  return distributeWordsInLine(backgroundText, begin, resolvedEnd, splitChar);
}

// -- Exports ------------------------------------------------------------------

export {
  createInitialBgWords,
  DEFAULT_BG_WORD_DURATION,
  distributeWordsInLine,
  evenlyTimedWords,
  splitIntoWords,
  splitIntoWordsWithMeta,
};
