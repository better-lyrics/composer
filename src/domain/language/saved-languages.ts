import type { SavedLanguages, SavedLineLanguage, SavedPieces } from "insync/saved-line";
import type { LanguagePieces, LineLanguage, LineLanguages } from "@/domain/language/model";
import { keyedPieces, positionalPieces } from "@/domain/language/pieces";

// -- Types --------------------------------------------------------------------

type Keyed = readonly { id: string }[];

interface SideSyllables {
  main: Keyed;
  bg: Keyed;
}

// -- Pieces -------------------------------------------------------------------

// Format 4 saves a reading by syllable position, since links carry no syllable ids.
function savedPieces(pieces: LanguagePieces | undefined, syllables: Keyed): SavedPieces | undefined {
  const positional = positionalPieces(syllables, pieces).map((piece) => piece ?? null);
  return positional.some((piece) => piece !== null) ? positional : undefined;
}

function piecesFromSaved(pieces: SavedPieces | undefined, syllables: Keyed): LanguagePieces | undefined {
  return (
    pieces &&
    keyedPieces(
      syllables,
      pieces.map((piece) => piece ?? undefined),
    )
  );
}

function savedSide<T extends { pieces?: LanguagePieces }>({ pieces, ...side }: T, syllables: Keyed) {
  const saved = savedPieces(pieces, syllables);
  return saved ? { ...side, pieces: saved } : side;
}

function sideFromSaved<T extends { pieces?: SavedPieces }>({ pieces, ...side }: T, syllables: Keyed) {
  const keyed = piecesFromSaved(pieces, syllables);
  return keyed ? { ...side, pieces: keyed } : side;
}

// -- Languages ----------------------------------------------------------------

function savedLineLanguage({ main, bg, ...language }: LineLanguage, syllables: SideSyllables): SavedLineLanguage {
  return { ...language, main: savedSide(main, syllables.main), ...(bg && { bg: savedSide(bg, syllables.bg) }) };
}

function lineLanguageFromSaved({ main, bg, ...language }: SavedLineLanguage, syllables: SideSyllables): LineLanguage {
  return {
    ...language,
    main: sideFromSaved(main, syllables.main),
    ...(bg && { bg: sideFromSaved(bg, syllables.bg) }),
  };
}

function mapValues<T, U>(record: Record<string, T>, map: (value: T) => U): Record<string, U> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, map(value)]));
}

function savedLanguages(languages: LineLanguages, syllables: SideSyllables): SavedLanguages | undefined {
  const { translations, transliteration, heldReadings, ...rest } = languages;
  const held =
    heldReadings &&
    bothSides(savedPieces(heldReadings.main, syllables.main), savedPieces(heldReadings.bg, syllables.bg));
  const saved: SavedLanguages = {
    ...rest,
    ...(translations && { translations: mapValues(translations, (track) => savedLineLanguage(track, syllables)) }),
    ...(transliteration && { transliteration: savedLineLanguage(transliteration, syllables) }),
    ...(held && { heldReadings: held }),
  };
  return Object.keys(saved).length ? saved : undefined;
}

function languagesFromSaved(saved: SavedLanguages, syllables: SideSyllables): LineLanguages | undefined {
  const { translations, transliteration, heldReadings, ...rest } = saved;
  const held =
    heldReadings &&
    bothSides(piecesFromSaved(heldReadings.main, syllables.main), piecesFromSaved(heldReadings.bg, syllables.bg));
  const languages: LineLanguages = {
    ...rest,
    ...(translations && { translations: mapValues(translations, (track) => lineLanguageFromSaved(track, syllables)) }),
    ...(transliteration && { transliteration: lineLanguageFromSaved(transliteration, syllables) }),
    ...(held && { heldReadings: held }),
  };
  return Object.keys(languages).length ? languages : undefined;
}

function bothSides<T>(main: T | undefined, bg: T | undefined): { main?: T; bg?: T } | undefined {
  if (main === undefined && bg === undefined) return undefined;
  return { ...(main !== undefined && { main }), ...(bg !== undefined && { bg }) };
}

// -- Exports ------------------------------------------------------------------

export { languagesFromSaved, savedLanguages };
