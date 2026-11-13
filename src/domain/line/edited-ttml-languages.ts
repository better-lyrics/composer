import { languagesWith, lineTranslations, lineTransliteration } from "@/domain/language/line-languages";
import type {
  LanguagePieces,
  LanguageSide,
  LineLanguage,
  LineLanguages,
  LineTranslations,
} from "@/domain/language/model";
import { keyedPieces, pieceOf, trackPieces, withTrackPieces } from "@/domain/language/pieces";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { hasAlternateText } from "@/utils/ttml-alternate-content";

// -- Types --------------------------------------------------------------------

interface MergedWords {
  words: WordTiming[] | undefined;
  backgroundWords: WordTiming[] | undefined;
}

// -- Comparison ---------------------------------------------------------------

function sameAlternateText(stored: LineLanguage | undefined, edited: LineLanguage | undefined): boolean {
  return (
    stored !== undefined &&
    edited !== undefined &&
    stored.main.text === edited.main.text &&
    (stored.bg?.text ?? "") === (edited.bg?.text ?? "")
  );
}

// -- Kinds --------------------------------------------------------------------

function mergedTranslations(stored: LyricLine, edited: LyricLine): LineTranslations | undefined {
  const storedTranslations = lineTranslations(stored);
  const editedTranslations = lineTranslations(edited);
  const merged: LineTranslations = {};
  for (const [language, track] of Object.entries(storedTranslations ?? {})) {
    if (!hasAlternateText(track) && !editedTranslations?.[language]) merged[language] = track;
  }
  for (const [language, track] of Object.entries(editedTranslations ?? {})) {
    const kept = storedTranslations?.[language];
    merged[language] = kept && sameAlternateText(kept, track) ? kept : track;
  }
  if (Object.keys(merged).length > 0) return merged;
  return storedTranslations && Object.keys(storedTranslations).length === 0 ? storedTranslations : undefined;
}

function mergedTransliteration(stored: LyricLine, edited: LyricLine): LineLanguage | undefined {
  const kept = lineTransliteration(stored);
  const track = lineTransliteration(edited);
  if (!track) return kept && !hasAlternateText(kept) ? kept : undefined;
  return kept && kept.language === track.language && sameAlternateText(kept, track) ? kept : track;
}

// -- Pieces -------------------------------------------------------------------

function wordsOf(line: LyricLine, side: LanguageSide): WordTiming[] | undefined {
  return side === "main" ? line.words : line.backgroundWords;
}

// A merged syllable kept from the project keeps its piece; one taken from the edit takes the edit's piece at its place.
function mergedSidePieces(
  stored: LyricLine,
  edited: LyricLine,
  side: LanguageSide,
  merged: WordTiming[] | undefined,
): LanguagePieces | undefined {
  const storedWords = wordsOf(stored, side);
  const storedPieces = trackPieces(stored, side);
  if (!merged || merged === storedWords) return storedPieces;
  const kept = new Set(storedWords);
  const editedWords = wordsOf(edited, side);
  const editedPieces = trackPieces(edited, side);
  return keyedPieces(
    merged,
    merged.map((word, index) => {
      if (kept.has(word)) return pieceOf(storedPieces, word);
      const source = editedWords?.[index];
      return source && pieceOf(editedPieces, source);
    }),
  );
}

// -- Functions ----------------------------------------------------------------

function mergedLanguages(stored: LyricLine, edited: LyricLine, merged: MergedWords): LineLanguages | undefined {
  const translations = mergedTranslations(stored, edited);
  const chosen = mergedTransliteration(stored, edited);
  const transliteration =
    chosen &&
    withTrackPieces(
      withTrackPieces(chosen, "main", mergedSidePieces(stored, edited, "main", merged.words)),
      "bg",
      mergedSidePieces(stored, edited, "bg", merged.backgroundWords),
    );
  return languagesWith(undefined, { translations, transliteration });
}

// -- Exports ------------------------------------------------------------------

export { mergedLanguages };
