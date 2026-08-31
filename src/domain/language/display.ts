import { withAlignedTransliteration } from "@/domain/language/align";
import { normalizeTransliterationForEditing, sourceWordCount } from "@/domain/language/transliteration-format";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { stripSplitCharacter } from "@/utils/split-character";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

type LanguageTextVariant = "original" | "transliteration";

interface LanguageDisplayLine {
  text: string;
  backgroundText?: string;
  words?: WordTiming[];
  backgroundWords?: WordTiming[];
  wordTexts?: string[];
  backgroundWordTexts?: string[];
}

function sourceSlots(text: string): WordTiming[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
  return parts.map((part, index) => ({
    text: trailingSpace[index] ? `${part} ` : part,
    begin: index,
    end: index + 1,
  }));
}

function comparableText(value: string): string {
  return stripSplitCharacter(value).replace(/\s+/g, " ").trim();
}

function displayText(word: WordTiming): string {
  return word.transliteration || word.text.trimEnd();
}

function displayAlignedText(words: WordTiming[], index: number, fallback: string): string {
  const word = words[index];
  const text = word.transliteration ?? fallback;
  if (index === words.length - 1) return text;
  return `${text}${word.transliterationJoinerAfter ?? (word.text.endsWith(" ") ? "  " : " ")}`;
}

function displayTrackTexts(
  originalText: string,
  alignedWords: WordTiming[] | undefined,
  alignedSourceSlots: WordTiming[] | undefined,
): string[] {
  const sourceTexts = alignedSourceSlots?.map(displayText) ?? [];
  if (!alignedWords?.length) return sourceTexts;

  const coversFullTrack =
    comparableText(alignedWords.map((word) => word.text).join("")) === comparableText(originalText);
  if (coversFullTrack) {
    const canUseSourceFallbackByIndex = alignedWords.length === sourceTexts.length;
    return alignedWords.map((word, index) =>
      displayAlignedText(alignedWords, index, canUseSourceFallbackByIndex ? sourceTexts[index] : word.text.trimEnd()),
    );
  }

  // A partially synced line still needs labels for its untimed suffix. Render
  // every canonical timing slot first (including syllable splits), then append
  // the synthetic labels for source words that have not been timed yet.
  const coveredSourceSlots = Math.min(
    sourceWordCount(alignedWords.map((word) => word.text).join("")),
    sourceTexts.length,
  );
  const canUseSourceFallbackByIndex = alignedWords.length === coveredSourceSlots;
  const timedTexts = alignedWords.map((word, index) =>
    displayAlignedText(alignedWords, index, canUseSourceFallbackByIndex ? sourceTexts[index] : word.text.trimEnd()),
  );
  return [...timedTexts, ...sourceTexts.slice(coveredSourceSlots)];
}

function getLanguageDisplayLine(line: LyricLine, variant: LanguageTextVariant): LanguageDisplayLine {
  if (variant === "original" || !line.transliteration?.text) {
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
    text: normalizeTransliterationForEditing(line.transliteration.text),
    backgroundText: line.transliteration.backgroundText
      ? normalizeTransliterationForEditing(line.transliteration.backgroundText)
      : line.backgroundText,
    words: alignedLine.words,
    backgroundWords: alignedLine.backgroundWords,
    wordTexts: displayTrackTexts(line.text, alignedLine.words, sourceLine.words),
    backgroundWordTexts: line.backgroundText
      ? displayTrackTexts(line.backgroundText, alignedLine.backgroundWords, sourceLine.backgroundWords)
      : undefined,
  };
}

export { getLanguageDisplayLine };
export type { LanguageDisplayLine, LanguageTextVariant };
