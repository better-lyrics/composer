import type { BackgroundLanguage, LanguageSide, LineLanguage } from "./language";
import { languagesWith, lineTransliteration } from "./language-line-languages";
import { hasReadings, mappedTransliteration, trackPieces, withoutOrphanPieces } from "./language-pieces";
import { normalizeTransliterationForEditing } from "./language-transliteration-format";
import type { LyricLine } from "./line";
import { backgroundTrack, mainTrack, timedSyllables, untimedSyllablesOf } from "./line-track";
import type { WordTiming } from "./word-timing";

// -- Helpers ------------------------------------------------------------------

function sideSyllables(line: LyricLine | undefined, side: LanguageSide): readonly WordTiming[] {
  if (!line) return [];
  return timedSyllables(side === "main" ? mainTrack(line) : backgroundTrack(line)) ?? [];
}

function sameSyllableIds(before: readonly WordTiming[], after: readonly WordTiming[]): boolean {
  return before.length === after.length && before.every((word, index) => word.id === after[index].id);
}

// The untimed rest holds no readings, so its part of the old text stays after the rebuilt readings.
function untimedReadingTail(text: string, before: LyricLine | undefined, side: LanguageSide): string | null {
  const spelled = before ? mappedTransliteration(sideSyllables(before, side), trackPieces(before, side)) : null;
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
    const tail = untimedSyllablesOf(line, side).length ? untimedReadingTail(sideTrack.text, before, side) : "";
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
