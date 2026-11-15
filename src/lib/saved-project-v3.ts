import {
  languagesFromV3,
  type V3LanguageFields,
  type V3Piece,
  v3PiecesOf,
  withoutV3Piece,
} from "@/domain/language/v3-languages";
import { type LineFields, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "insync/line";
import { withSplitMarksFromWords } from "@/domain/line/reconstruct-text";
import { backgroundTrack, mainTrack, timedSyllables } from "insync/line-track";
import { type SpacedWord, wordsFromSpaced } from "insync/word-spaced-words";
import type { WordTiming } from "insync/word-timing";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

type SavedWordV3 = SpacedWord & V3Piece;

// A line as saved in a version 3 record or link: words keep their separator inside `text` and their reading.
type SavedLineV3 = Omit<LineFields, "words" | "backgroundWords" | "languages"> &
  V3LanguageFields & {
    words?: SavedWordV3[];
    backgroundWords?: SavedWordV3[];
    begin?: number;
    end?: number;
  };

// -- Reading ------------------------------------------------------------------

// Version 3 never saved ids: anything already on saved words came from outside and is never trusted.
function wordsFromSaved(words: readonly SavedWordV3[]): WordTiming[] {
  return wordsFromSpaced(words.map(({ id: _id, ...word }) => withoutV3Piece(word)));
}

function lineFromSavedV3(line: SavedLineV3, splitChar: string): LyricLine {
  const { words, backgroundWords, translations, transliteration, ...fields } = line;
  const storeWords = words && wordsFromSaved(words);
  const storeBackgroundWords = backgroundWords && wordsFromSaved(backgroundWords);
  const text = storeWords?.length ? withSplitMarksFromWords(fields.text, storeWords, splitChar) : fields.text;
  const backgroundText =
    storeBackgroundWords?.length && fields.backgroundText !== undefined
      ? withSplitMarksFromWords(fields.backgroundText, storeBackgroundWords, splitChar)
      : fields.backgroundText;
  const stored = lineFromFields(
    {
      ...fields,
      text,
      ...(backgroundText !== undefined && { backgroundText }),
      ...(storeWords && { words: storeWords }),
      ...(storeBackgroundWords && { backgroundWords: storeBackgroundWords }),
    },
    splitChar,
  );
  const languages = languagesFromV3(
    { translations, transliteration },
    { main: v3PiecesOf(words), bg: v3PiecesOf(backgroundWords) },
    { words: timedSyllables(mainTrack(stored)), backgroundWords: timedSyllables(backgroundTrack(stored)) },
  );
  return languages ? { ...stored, languages } : stored;
}

function linesFromSavedV3(lines: readonly SavedLineV3[]): LyricLine[] {
  const splitChar = getSplitCharacter();
  return lines.map((line) => lineFromSavedV3(line, splitChar));
}

// -- Exports ------------------------------------------------------------------

export type { SavedLineV3 };
export { linesFromSavedV3 };
