import type { LineLanguage, LineLanguages } from "./language";
import { languagesWith, lineTranslations, lineTransliteration } from "./language-line-languages";
import { withAddedPieces } from "./language-pieces";
import { sidePieces } from "./language-side-pieces";
import type { LyricLine, MainTrack, Syllable } from "./line";
import { backgroundTrack, isSpanTimed, isTimedSyllable, mainTrack } from "./line-track";
import { withMainTrack, withTrackSpan, withTrackSyllables } from "./line-track-writes";

// -- Helpers ------------------------------------------------------------------

// Each line's last syllable ends its word with the text typed between the two lines, which may be none.
function seamedSyllables(tracks: readonly MainTrack[], seams: readonly string[]): Syllable[] {
  return tracks.flatMap((track, index) => {
    if (index === tracks.length - 1) return [...track.syllables];
    const last = track.syllables.at(-1);
    if (!last) return [];
    return [...track.syllables.slice(0, -1), { ...last, sep: seams[index], joinsNext: false }];
  });
}

function joinedTrack(tracks: readonly MainTrack[], seams: readonly string[]): MainTrack | null {
  const [first] = tracks;
  const syllables = seamedSyllables(tracks, seams);
  if (tracks.every(isSpanTimed)) {
    const last = tracks[tracks.length - 1];
    return withTrackSpan(withTrackSyllables(first, syllables), first.begin ?? 0, last.end ?? 0);
  }
  if (tracks.some(isSpanTimed)) return null;
  const firstUntimed = syllables.findIndex((syllable) => !isTimedSyllable(syllable));
  const timedAfterUntimed = firstUntimed >= 0 && syllables.slice(firstUntimed).some(isTimedSyllable);
  return timedAfterUntimed ? null : withTrackSyllables(first, syllables);
}

// One language of the joined line: the first line's, its text every line's text in order.
function joinedLanguage(languages: readonly (LineLanguage | undefined)[]): LineLanguage | undefined {
  const present = languages.filter((language) => language !== undefined);
  const [first] = present;
  if (!first || present.length === 1) return first;
  const text = present
    .map((language) => language.main.text.trim())
    .filter(Boolean)
    .join(" ");
  if (text === first.main.text) return first;
  const { segments: _segments, ...main } = first.main;
  return { ...first, main: { ...main, text } };
}

function joinedTexts(lines: readonly LyricLine[]): LineLanguages | undefined {
  const keys = new Set(lines.flatMap((line) => Object.keys(lineTranslations(line) ?? {})));
  const translations = Object.fromEntries(
    [...keys].flatMap((key) => {
      const joined = joinedLanguage(lines.map((line) => lineTranslations(line)?.[key]));
      return joined ? [[key, joined] as const] : [];
    }),
  );
  return languagesWith(lines[0].languages, {
    translations: keys.size ? translations : undefined,
    transliteration: joinedLanguage(lines.map(lineTransliteration)),
  });
}

// -- Functions ----------------------------------------------------------------

// Lines whose rows were joined in Edit become the first line, holding every line's syllables and readings in order.
// `seams` are the texts typed between consecutive lines. Lines with their own background or group stay apart.
function joinedLines(lines: readonly LyricLine[], seams: readonly string[]): LyricLine | null {
  const [first, ...rest] = lines;
  if (!first || rest.length === 0 || seams.length !== rest.length) return null;
  if (lines.some((line) => line.groupId !== undefined) || rest.some((line) => backgroundTrack(line))) return null;
  const track = joinedTrack(lines.map(mainTrack), seams);
  if (!track) return null;
  const languages = rest.reduce(
    (written, line) => withAddedPieces(written, "main", sidePieces(line.languages, "main") ?? {}),
    joinedTexts(lines),
  );
  const joined = withMainTrack(first, track);
  return languages ? { ...joined, languages } : joined;
}

// -- Exports ------------------------------------------------------------------

export { joinedLines };
