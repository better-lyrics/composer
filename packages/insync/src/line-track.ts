import type {
  BackgroundTrack,
  LineTrack,
  LyricLine,
  MainTrack,
  SpanTimedTrack,
  Syllable,
  TrackRole,
  UntimedSyllable,
} from "./line";
import type { WordTiming } from "./word-timing";

// -- Types --------------------------------------------------------------------

type WordTrack = "word" | "bg";
type TrackField = "words" | "backgroundWords";

// -- Constants ----------------------------------------------------------------

const NO_TIMED_SYLLABLES: WordTiming[] = [];
Object.freeze(NO_TIMED_SYLLABLES);
const NO_UNTIMED_SYLLABLES: Syllable[] = [];
Object.freeze(NO_UNTIMED_SYLLABLES);

// -- Tracks -------------------------------------------------------------------

function mainTrack(line: LyricLine): MainTrack {
  return line.tracks[0];
}

function backgroundTrack(line: LyricLine): BackgroundTrack | undefined {
  return line.tracks[1];
}

function trackOf(line: LyricLine, role: TrackRole): LineTrack | undefined {
  return role === "main" ? mainTrack(line) : backgroundTrack(line);
}

// -- Syllables ----------------------------------------------------------------

function isTimedSyllable(syllable: Syllable): syllable is WordTiming {
  return syllable.begin !== undefined;
}

function isSpanTimed<T extends LineTrack>(track: T): track is T & SpanTimedTrack {
  return track.begin !== undefined;
}

const timedByTrack = new WeakMap<LineTrack, WordTiming[]>();

// The timed syllables of a track, one array per track so identity checks and caches keyed on it hold.
function timedSyllables(track: LineTrack | undefined): WordTiming[] {
  if (!track) return NO_TIMED_SYLLABLES;
  const cached = timedByTrack.get(track);
  if (cached) return cached;
  const syllables: readonly Syllable[] = track.syllables;
  const timed = syllables.filter(isTimedSyllable);
  const result = timed.length === 0 ? NO_TIMED_SYLLABLES : timed;
  timedByTrack.set(track, result);
  return result;
}

function untimedSyllable({ begin: _begin, end: _end, ...syllable }: Syllable): UntimedSyllable {
  return syllable;
}

const untimedByTrack = new WeakMap<LineTrack, Syllable[]>();

// The untimed syllables of a role's track, the ones new words must not take the ids of. One array per track.
function untimedSyllablesOf(line: LyricLine, role: TrackRole): Syllable[] {
  const track = trackOf(line, role);
  if (!track) return NO_UNTIMED_SYLLABLES;
  const cached = untimedByTrack.get(track);
  if (cached) return cached;
  const untimed = track.syllables.filter((syllable) => !isTimedSyllable(syllable));
  const result = untimed.length === 0 ? NO_UNTIMED_SYLLABLES : untimed;
  untimedByTrack.set(track, result);
  return result;
}

// -- Lanes --------------------------------------------------------------------

function trackRole(type: WordTrack): TrackRole {
  return type === "word" ? "main" : "bg";
}

function fieldRole(field: TrackField): TrackRole {
  return field === "words" ? "main" : "bg";
}

function trackField(type: WordTrack): TrackField {
  return type === "word" ? "words" : "backgroundWords";
}

// The timed words of a lane, or nothing when it has none (or there is no line).
function roleWords(line: LyricLine | undefined, role: TrackRole): WordTiming[] | undefined {
  const timed = timedSyllables(line && trackOf(line, role));
  return timed.length > 0 ? timed : undefined;
}

function trackWords(line: LyricLine, type: WordTrack): WordTiming[] | undefined {
  return roleWords(line, trackRole(type));
}

function fieldWords(line: LyricLine, field: TrackField): WordTiming[] | undefined {
  return roleWords(line, fieldRole(field));
}

// -- Exports ------------------------------------------------------------------

export {
  backgroundTrack,
  fieldRole,
  fieldWords,
  isSpanTimed,
  isTimedSyllable,
  mainTrack,
  roleWords,
  timedSyllables,
  trackField,
  trackOf,
  trackRole,
  trackWords,
  untimedSyllable,
  untimedSyllablesOf,
};
export type { TrackField, WordTrack };
