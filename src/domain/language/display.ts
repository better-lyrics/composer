import { withAlignedTransliteration } from "@/domain/language/align";
import {
  normalizeTransliterationForEditing,
  sourceWordCount,
  timedTransliterationSlice,
} from "@/domain/language/transliteration-format";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { spacedText, wordsFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { stripSplitCharacter } from "@/utils/split-character";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

type LanguageTextVariant = "original" | "transliteration";

function isLanguageTextVariant(value: unknown): value is LanguageTextVariant {
  return value === "original" || value === "transliteration";
}

interface LanguageDisplayLine {
  text: string;
  backgroundText?: string;
  words?: WordTiming[];
  backgroundWords?: WordTiming[];
  wordTexts?: string[];
  backgroundWordTexts?: string[];
}

// Scratch slots for labels only; they never reach the store, so they need no fresh ids.
function sourceSlots(text: string): WordTiming[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
  return wordsFromSpaced(
    parts.map((part, index) => ({
      id: `slot-${index}`,
      text: trailingSpace[index] ? `${part} ` : part,
      begin: index,
      end: index + 1,
    })),
  );
}

function comparableText(value: string): string {
  return stripSplitCharacter(value).replace(/\s+/g, " ").trim();
}

function displayText(word: WordTiming, index: number, words: WordTiming[]): string {
  return timedTransliterationSlice({
    text: word.transliteration || word.text,
    joinerAfter: index < words.length - 1 ? word.transliterationJoinerAfter : undefined,
  }).text;
}

function displayAlignedText(words: WordTiming[], index: number, fallback: string): string {
  const word = words[index];
  const text = word.transliteration ?? fallback;
  if (index === words.length - 1) return text;
  const timed = timedTransliterationSlice({
    text,
    joinerAfter: word.transliterationJoinerAfter ?? (word.sep.endsWith(" ") ? "  " : " "),
  });
  return `${timed.text}${timed.joinerAfter ?? ""}`;
}

function displayTrackTexts(
  originalText: string,
  alignedWords: WordTiming[] | undefined,
  alignedSourceSlots: WordTiming[] | undefined,
): string[] {
  const sourceTexts = alignedSourceSlots?.map(displayText) ?? [];
  if (!alignedWords?.length) return sourceTexts;

  const coversFullTrack = comparableText(spacedText(alignedWords)) === comparableText(originalText);
  if (coversFullTrack) {
    const canUseSourceFallbackByIndex = alignedWords.length === sourceTexts.length;
    return alignedWords.map((word, index) =>
      displayAlignedText(alignedWords, index, canUseSourceFallbackByIndex ? sourceTexts[index] : word.text),
    );
  }

  // A partially synced line still needs labels for its untimed suffix. Render
  // every canonical timing slot first (including syllable splits), then append
  // the synthetic labels for source words that have not been timed yet.
  const coveredSourceSlots = Math.min(sourceWordCount(spacedText(alignedWords)), sourceTexts.length);
  const canUseSourceFallbackByIndex = alignedWords.length === coveredSourceSlots;
  const timedTexts = alignedWords.map((word, index) =>
    displayAlignedText(alignedWords, index, canUseSourceFallbackByIndex ? sourceTexts[index] : word.text),
  );
  return [...timedTexts, ...sourceTexts.slice(coveredSourceSlots)];
}

function getLanguageDisplayLine(line: LyricLine, variant: LanguageTextVariant): LanguageDisplayLine {
  if (variant === "original" || !line.transliteration) {
    return {
      text: line.text,
      backgroundText: line.backgroundText,
      words: line.words,
      backgroundWords: line.backgroundWords,
    };
  }

  const alignedLine = withAlignedTransliteration(line);
  const sourceLine = withAlignedTransliteration(
    reconcileLine({
      ...line,
      words: sourceSlots(line.text),
      ...(line.backgroundText ? { backgroundWords: sourceSlots(line.backgroundText) } : {}),
    }),
  );

  return {
    text: line.transliteration.text ? normalizeTransliterationForEditing(line.transliteration.text) : line.text,
    backgroundText: line.transliteration.backgroundText
      ? normalizeTransliterationForEditing(line.transliteration.backgroundText)
      : line.backgroundText,
    words: alignedLine.words,
    backgroundWords: alignedLine.backgroundWords,
    wordTexts: line.transliteration.text
      ? displayTrackTexts(line.text, alignedLine.words, sourceLine.words)
      : undefined,
    backgroundWordTexts:
      line.backgroundText && line.transliteration.backgroundText
        ? displayTrackTexts(line.backgroundText, alignedLine.backgroundWords, sourceLine.backgroundWords)
        : undefined,
  };
}

export { getLanguageDisplayLine, isLanguageTextVariant };
export type { LanguageDisplayLine, LanguageTextVariant };
