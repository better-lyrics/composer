import { alternateMatchesMainText } from "@/domain/language/alternate-visibility";
import type { Lyric } from "@braccato/core";

// -- Functions -----------------------------------------------------------------

function firstTranslation(lyric: Lyric): Lyric["translation"] {
  if (lyric.translation) return lyric.translation;
  const [entry] = Object.entries(lyric.translations ?? {});
  return entry ? { lang: entry[0], text: entry[1] } : undefined;
}

// The renderer shows each line's own romanization and translation, so one that only repeats the
// line is dropped here, and a line shows at most one translation.
function withShownAlternates(lyric: Lyric): Lyric {
  if (lyric.isInstrumental) return lyric;
  const { romanization, timedRomanization, translations, translation, ...rest } = lyric;
  const next: Lyric = rest;
  if (romanization && !alternateMatchesMainText(romanization, lyric.words)) {
    next.romanization = romanization;
    if (timedRomanization) next.timedRomanization = timedRomanization;
  }
  const shownTranslation = firstTranslation(lyric);
  if (shownTranslation && !alternateMatchesMainText(shownTranslation.text, lyric.words)) {
    next.translation = shownTranslation;
  }
  return next;
}

function braccatoLyrics(lyrics: Lyric[]): Lyric[] {
  return lyrics.map(withShownAlternates);
}

// -- Exports -------------------------------------------------------------------

export { braccatoLyrics };
