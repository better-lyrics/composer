import { roleWords } from "insync/line-track";
import { backgroundText, lineText } from "@/domain/line/text";
import { withAlignedTransliteration } from "@/domain/language/align";
import { lineTransliteration } from "@/domain/language/line-languages";
import type { LanguagePieces, LineLanguages } from "insync/language";
import { pieceOf, trackPieces } from "@/domain/language/pieces";
import {
  normalizeTransliterationForEditing,
  sourceWordCount,
  timedTransliterationSlice,
} from "@/domain/language/transliteration-format";
import type { LyricLine } from "insync/line";
import { withRoleWords } from "@/domain/line/track-writes";
import { spacedText, wordsFromSpaced } from "insync/word-spaced-words";
import type { WordTiming } from "insync/word-timing";
import { withoutSplitCharacter } from "insync/split-character-text";
import { splitIntoWordsWithMeta } from "@/utils/lyric-words";

type LanguageTextVariant = "original" | "transliteration";

function isLanguageTextVariant(value: unknown): value is LanguageTextVariant {
  return value === "original" || value === "transliteration";
}

interface LanguageDisplayLine {
  text: string;
  backgroundText?: string;
  words?: WordTiming[];
  backgroundWords?: WordTiming[];
  /** The line's languages with each timed syllable's reading aligned to the current text. */
  languages?: LineLanguages;
  wordTexts?: string[];
  backgroundWordTexts?: string[];
}

// Scratch slots for labels only; they never reach the store, so they need no fresh ids.
function sourceSlots(text: string, splitChar: string): WordTiming[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text, splitChar);
  return wordsFromSpaced(
    parts.map((part, index) => ({
      id: `slot-${index}`,
      text: trailingSpace[index] ? `${part} ` : part,
      begin: index,
      end: index + 1,
    })),
  );
}

function comparableText(value: string, splitChar: string): string {
  return withoutSplitCharacter(value, splitChar).replace(/\s+/g, " ").trim();
}

interface PiecedWords {
  words: WordTiming[];
  pieces: LanguagePieces | undefined;
}

function displayText({ words, pieces }: PiecedWords, index: number): string {
  const piece = pieceOf(pieces, words[index]);
  return timedTransliterationSlice({
    text: piece?.text || words[index].text,
    joinerAfter: index < words.length - 1 ? piece?.joinerAfter : undefined,
  }).text;
}

function displayAlignedText({ words, pieces }: PiecedWords, index: number, fallback: string): string {
  const word = words[index];
  const piece = pieceOf(pieces, word);
  const text = piece?.text ?? fallback;
  if (index === words.length - 1) return text;
  const timed = timedTransliterationSlice({
    text,
    joinerAfter: piece?.joinerAfter ?? (word.sep.endsWith(" ") ? "  " : " "),
  });
  return `${timed.text}${timed.joinerAfter ?? ""}`;
}

function piecedWords(line: LyricLine, side: "main" | "bg"): PiecedWords | undefined {
  const words = side === "main" ? roleWords(line, "main") : roleWords(line, "bg");
  return words && { words, pieces: trackPieces(line, side) };
}

function displayTrackTexts(
  originalText: string,
  aligned: PiecedWords | undefined,
  alignedSourceSlots: PiecedWords | undefined,
  splitChar: string,
): string[] {
  const sourceTexts = alignedSourceSlots?.words.map((_, index) => displayText(alignedSourceSlots, index)) ?? [];
  if (!aligned?.words.length) return sourceTexts;
  const alignedWords = aligned.words;

  const coversFullTrack =
    comparableText(spacedText(alignedWords), splitChar) === comparableText(originalText, splitChar);
  if (coversFullTrack) {
    const canUseSourceFallbackByIndex = alignedWords.length === sourceTexts.length;
    return alignedWords.map((word, index) =>
      displayAlignedText(aligned, index, canUseSourceFallbackByIndex ? sourceTexts[index] : word.text),
    );
  }

  // A partially synced line still needs labels for its untimed suffix. Render
  // every canonical timing slot first (including syllable splits), then append
  // the synthetic labels for source words that have not been timed yet.
  const coveredSourceSlots = Math.min(sourceWordCount(spacedText(alignedWords)), sourceTexts.length);
  const canUseSourceFallbackByIndex = alignedWords.length === coveredSourceSlots;
  const timedTexts = alignedWords.map((word, index) =>
    displayAlignedText(aligned, index, canUseSourceFallbackByIndex ? sourceTexts[index] : word.text),
  );
  return [...timedTexts, ...sourceTexts.slice(coveredSourceSlots)];
}

function getLanguageDisplayLine(line: LyricLine, variant: LanguageTextVariant, splitChar: string): LanguageDisplayLine {
  const transliteration = lineTransliteration(line);
  if (variant === "original" || !transliteration) {
    return {
      text: lineText(line, splitChar),
      backgroundText: backgroundText(line, splitChar),
      words: roleWords(line, "main"),
      backgroundWords: roleWords(line, "bg"),
    };
  }

  const alignedLine = withAlignedTransliteration(line, splitChar);
  const text = lineText(line, splitChar);
  const background = backgroundText(line, splitChar);
  const sourceLine = withAlignedTransliteration(
    background
      ? withRoleWords(
          withRoleWords(line, "main", sourceSlots(text, splitChar)),
          "bg",
          sourceSlots(background, splitChar),
        )
      : withRoleWords(line, "main", sourceSlots(text, splitChar)),
    splitChar,
  );

  return {
    text: transliteration.main.text ? normalizeTransliterationForEditing(transliteration.main.text) : text,
    backgroundText: transliteration.bg?.text ? normalizeTransliterationForEditing(transliteration.bg.text) : background,
    words: roleWords(alignedLine, "main"),
    backgroundWords: roleWords(alignedLine, "bg"),
    languages: alignedLine.languages,
    wordTexts: transliteration.main.text
      ? displayTrackTexts(text, piecedWords(alignedLine, "main"), piecedWords(sourceLine, "main"), splitChar)
      : undefined,
    backgroundWordTexts:
      background && transliteration.bg?.text
        ? displayTrackTexts(background, piecedWords(alignedLine, "bg"), piecedWords(sourceLine, "bg"), splitChar)
        : undefined,
  };
}

export { getLanguageDisplayLine, isLanguageTextVariant };
export type { LanguageDisplayLine, LanguageTextVariant };
