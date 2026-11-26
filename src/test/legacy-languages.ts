import type { LanguagePieces, LineLanguage, LineLanguages } from "@/domain/language/model";
import { keyedPieces } from "@/domain/language/pieces";
import {
  languagesFromV3,
  lineLanguageFromV3,
  type V3LanguageFields,
  type V3Piece,
  type V3TranslationTrack,
  type V3TransliterationTrack,
  v3Languages,
  v3PiecesOf,
  v3WordPieces,
  withoutV3Piece,
} from "@/domain/language/v3-languages";
import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Types --------------------------------------------------------------------

// Fixtures spelled the way version 3 records spell languages: readings on the words, flat background fields.
type LegacyWord = WordTiming & V3Piece;

type LegacyLine = Omit<LooseLine, "words" | "backgroundWords" | "languages"> &
  V3LanguageFields & {
    words?: LegacyWord[];
    backgroundWords?: LegacyWord[];
  };

// -- Functions ----------------------------------------------------------------

function legacyLine({ words, backgroundWords, translations, transliteration, ...fields }: LegacyLine): LyricLine {
  const storeWords = words?.map(withoutV3Piece);
  const storeBackgroundWords = backgroundWords?.map(withoutV3Piece);
  const languages = languagesFromV3(
    { translations, transliteration },
    { main: v3PiecesOf(words), bg: v3PiecesOf(backgroundWords) },
    { words: storeWords, backgroundWords: storeBackgroundWords },
  );
  const line = reconcileLine({
    ...fields,
    ...(storeWords && { words: storeWords }),
    ...(storeBackgroundWords && { backgroundWords: storeBackgroundWords }),
    ...(languages && { languages }),
  });
  const kept = [
    ...(legacyWords(line.words, languages) ?? []),
    ...(legacyWords(line.backgroundWords, languages, "bg") ?? []),
  ];
  const given = [...(words ?? []), ...(backgroundWords ?? [])];
  if (!isStructurallyEqual(v3PiecesOf(kept), v3PiecesOf(given))) {
    throw new Error(`legacyLine dropped syllable readings of line ${line.id}`);
  }
  return line;
}

function legacyWords(
  words: readonly WordTiming[] | undefined,
  languages: LineLanguages | undefined,
  side: "main" | "bg" = "main",
): LegacyWord[] | undefined {
  const pieces = v3WordPieces(words, languages, side);
  return words?.map((word, index) => ({ ...word, ...pieces?.[index] }));
}

function piecesOfLegacyWords(words: readonly LegacyWord[]): {
  words: WordTiming[];
  pieces: LanguagePieces | undefined;
} {
  const plain = words.map(withoutV3Piece);
  return { words: plain, pieces: keyedPieces(plain, v3PiecesOf(words) ?? []) };
}

function wordsWithPieces(words: readonly WordTiming[], pieces: LanguagePieces | undefined): LegacyWord[] {
  return (
    legacyWords(words, {
      transliteration: { language: "", main: { text: "", pieces }, origin: "manual", sourceFingerprint: "" },
    }) ?? []
  );
}

function legacyView(line: LyricLine): LegacyLine {
  const { languages, words, backgroundWords, ...fields } = line;
  return {
    ...fields,
    ...(words && { words: legacyWords(words, languages) }),
    ...(backgroundWords && { backgroundWords: legacyWords(backgroundWords, languages, "bg") }),
    ...legacyLanguages(languages),
  };
}

function legacyTrack(track: V3TranslationTrack | V3TransliterationTrack): LineLanguage {
  return lineLanguageFromV3(track);
}

function legacyLanguages(languages: LineLanguages | undefined): V3LanguageFields {
  return v3Languages(languages);
}

// -- Exports ------------------------------------------------------------------

export type { LegacyLine, LegacyWord };
export { legacyLanguages, legacyLine, legacyTrack, legacyView, legacyWords, piecesOfLegacyWords, wordsWithPieces };
