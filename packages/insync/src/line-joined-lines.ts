import type { LanguageContentOrigin, LineLanguage, LineLanguages, TransliterationAlignmentStatus } from "./language";
import { languagesWith, lineTranslations, lineTransliteration } from "./language-line-languages";
import { withAddedPieces } from "./language-pieces";
import { sidePieces } from "./language-side-pieces";
import type { LyricLine, MainTrack, Syllable } from "./line";
import { backgroundTrack, isSpanTimed, isTimedSyllable, mainTrack } from "./line-track";
import { withMainTrack, withTrackSpan, withTrackSyllables } from "./line-track-writes";

// -- Constants ----------------------------------------------------------------

// Weakest first: a joined track is only as aligned as its least aligned part.
const ALIGNMENT_STRENGTH: readonly (TransliterationAlignmentStatus | undefined)[] = [
  "unresolved",
  "needs-review",
  "inferred",
  "confirmed",
  undefined,
];

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

const inTimeOrder = (begins: readonly number[]) =>
  begins.every((begin, index) => index === 0 || begin >= begins[index - 1]);

function joinedTrack(tracks: readonly MainTrack[], seams: readonly string[]): MainTrack | null {
  const [first] = tracks;
  const syllables = seamedSyllables(tracks, seams);
  if (tracks.every(isSpanTimed)) {
    if (!inTimeOrder(tracks.map((track) => track.begin))) return null;
    const end = Math.max(...tracks.map((track) => track.end ?? 0));
    return withTrackSpan(withTrackSyllables(first, syllables), first.begin ?? 0, end);
  }
  if (tracks.some(isSpanTimed)) return null;
  const firstUntimed = syllables.findIndex((syllable) => !isTimedSyllable(syllable));
  const timedAfterUntimed = firstUntimed >= 0 && syllables.slice(firstUntimed).some(isTimedSyllable);
  if (timedAfterUntimed || !inTimeOrder(syllables.filter(isTimedSyllable).map((syllable) => syllable.begin)))
    return null;
  return withTrackSyllables(first, syllables);
}

// Generated only when every part was: a refresh would overwrite any hand text, which is reviewed instead.
function joinedOrigin(present: readonly LineLanguage[]): LanguageContentOrigin {
  if (present.every((language) => language.origin === "google")) return "google";
  return present.some((language) => language.origin === "manual") ? "manual" : "import";
}

function joinedAlignment(present: readonly LineLanguage[], origin: LanguageContentOrigin) {
  if (origin !== "google" && present.some((language) => language.origin === "google")) return "needs-review";
  const ranks = present.map((language) => ALIGNMENT_STRENGTH.indexOf(language.main.alignmentStatus));
  return ALIGNMENT_STRENGTH[Math.min(...ranks)];
}

// One language of the joined line: the first line's, its text every line's text in order, stale when sources differ.
function joinedLanguage(languages: readonly (LineLanguage | undefined)[]): LineLanguage | undefined {
  const present = languages.filter((language) => language !== undefined);
  const [first] = present;
  if (!first || present.length === 1) return first;
  const text = present
    .map((language) => language.main.text.trim())
    .filter(Boolean)
    .join(" ");
  if (text === first.main.text) return first;
  const origin = joinedOrigin(present);
  const alignmentStatus = joinedAlignment(present, origin);
  const sameSource = present.every((language) => language.sourceFingerprint === first.sourceFingerprint);
  const sourceFingerprint = sameSource ? first.sourceFingerprint : "";
  const { segments: _segments, alignmentStatus: _status, ...main } = first.main;
  return {
    ...first,
    origin,
    sourceFingerprint,
    main: { ...main, text, ...(alignmentStatus !== undefined && { alignmentStatus }) },
  };
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
