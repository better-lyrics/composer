import type { V3Piece } from "@/domain/language/v3-languages";
import { v3Languages, v3WordPieces } from "@/domain/language/v3-languages";
import { fieldsOfLine } from "@/domain/line/line-from-fields";
import type { LyricLine } from "insync/line";
import { spacedFromWords } from "@/domain/word/spaced-words";
import type { WordTiming } from "insync/word-timing";
import type { SavedLineV3 } from "@/lib/saved-project-v3";

// -- Writing ------------------------------------------------------------------

// Lines as a version 3 save wrote them, for records and links made before format 4.
function savedWordsV3(words: readonly WordTiming[], pieces: readonly V3Piece[] | undefined) {
  return spacedFromWords(words).map((word, index) => ({ ...word, ...pieces?.[index] }));
}

function savedLineV3(line: LyricLine): SavedLineV3 {
  const { languages, words, backgroundWords, ...fields } = fieldsOfLine(line);
  return {
    ...fields,
    ...(words && { words: savedWordsV3(words, v3WordPieces(words, languages, "main")) }),
    ...(backgroundWords && {
      backgroundWords: savedWordsV3(backgroundWords, v3WordPieces(backgroundWords, languages, "bg")),
    }),
    ...v3Languages(languages),
  };
}

function savedLinesV3(lines: readonly LyricLine[]): SavedLineV3[] {
  return lines.map(savedLineV3);
}

// -- Exports ------------------------------------------------------------------

export { savedLinesV3 };
