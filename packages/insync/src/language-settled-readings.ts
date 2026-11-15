import type { BackgroundLanguage, LanguageSide, LineLanguage } from "./language";
import { languagesWith, lineTransliteration } from "./language-line-languages";
import { hasReadings, mappedTransliteration, trackPieces, withoutOrphanPieces } from "./language-pieces";
import { normalizeTransliterationForEditing } from "./language-transliteration-format";
import type { LyricLine, Syllable } from "./line";
import { backgroundTrack, isTimedSyllable, mainTrack, timedSyllables, untimedSyllablesOf } from "./line-track";
import type { WordTiming } from "./word-timing";

// -- Helpers ------------------------------------------------------------------

function sideSyllables(line: LyricLine | undefined, side: LanguageSide): readonly WordTiming[] {
  if (!line) return [];
  return timedSyllables(side === "main" ? mainTrack(line) : backgroundTrack(line)) ?? [];
}

function sameSyllableIds(before: readonly WordTiming[], after: readonly WordTiming[]): boolean {
  return before.length === after.length && before.every((word, index) => word.id === after[index].id);
}

function trackSyllables(line: LyricLine | undefined, side: LanguageSide): readonly Syllable[] {
  if (!line) return [];
  return (side === "main" ? mainTrack(line) : backgroundTrack(line))?.syllables ?? [];
}

// The old text spells the old syllables up to the untimed rest; the rest keeps its part of the old text after the
// rebuilt readings, so a syllable that lost its timing keeps its text and one that gained it leaves the rest.
function untimedReadingTail(text: string, before: LyricLine | undefined, line: LyricLine, side: LanguageSide) {
  const untimed = new Set(untimedSyllablesOf(line, side).map((syllable) => syllable.id));
  const timed = new Set(sideSyllables(line, side).map((syllable) => syllable.id));
  const beforeSyllables = trackSyllables(before, side);
  const spelledSyllables = beforeSyllables.filter((syllable) =>
    isTimedSyllable(syllable) ? !untimed.has(syllable.id) : timed.has(syllable.id),
  );
  if (spelledSyllables.some((syllable, index) => syllable !== beforeSyllables[index])) return null;
  const spelled = mappedTransliteration(spelledSyllables, before && trackPieces(before, side));
  if (spelled === null) return null;
  const old = normalizeTransliterationForEditing(text);
  const prefix = normalizeTransliterationForEditing(spelled);
  if (!old.startsWith(prefix)) return null;
  const tail = old.slice(prefix.length);
  return tail === "" || tail.trimStart() !== tail ? tail : null;
}

// Text spelled by the pieces replaces the old text and its segments; a syllable with no reading leaves the text for the user.
function settledSide<T extends BackgroundLanguage>(sideTrack: T, words: readonly WordTiming[], tail: string | null): T {
  const spelled = tail === null ? null : mappedTransliteration([...words], sideTrack.pieces);
  if (spelled === null) {
    return sideTrack.alignmentStatus === "needs-review" ? sideTrack : { ...sideTrack, alignmentStatus: "needs-review" };
  }
  const text = spelled + tail;
  if (normalizeTransliterationForEditing(text) === normalizeTransliterationForEditing(sideTrack.text ?? ""))
    return sideTrack;
  const { segments: _segments, ...rest } = sideTrack;
  return { ...rest, text } as T;
}

function settledTrack(track: LineLanguage, before: LyricLine | undefined, line: LyricLine): LineLanguage {
  let settled = track;
  for (const side of ["main", "bg"] as const) {
    const sideTrack = settled[side];
    const words = sideSyllables(line, side);
    if (!sideTrack?.text?.trim() || words.length === 0) continue;
    if (sameSyllableIds(sideSyllables(before, side), words)) continue;
    if (!hasReadings(trackPieces(before ?? line, side))) continue;
    const tail = untimedSyllablesOf(line, side).length ? untimedReadingTail(sideTrack.text, before, line, side) : "";
    const next = settledSide(sideTrack, words, tail);
    if (next !== sideTrack) settled = { ...settled, [side]: next };
  }
  return settled;
}

// -- Functions ----------------------------------------------------------------

// A line whose timed syllables changed drops readings of syllables it lost and spells its romanization from the rest.
function withSettledReadings<T extends LyricLine>(before: LyricLine | undefined, line: T): T {
  const owned = withoutOrphanPieces(line);
  const track = lineTransliteration(owned);
  if (!track) return owned;
  const settled = settledTrack(track, before, owned);
  if (settled === track) return owned;
  return { ...owned, languages: languagesWith(owned.languages, { transliteration: settled }) };
}

// -- Exports ------------------------------------------------------------------

export { withSettledReadings };
