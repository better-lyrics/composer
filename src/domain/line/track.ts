import { tracksFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

type UntimedSyllable = Omit<WordTiming, "begin" | "end"> & { begin?: never; end?: never };
type Syllable = WordTiming | UntimedSyllable;
type TrackRole = "main" | "bg";

interface LineTrack {
  readonly id: string;
  readonly role: TrackRole;
  readonly syllables: readonly Syllable[];
  readonly begin?: number;
  readonly end?: number;
  readonly source?: "extraction" | "manual";
}

// -- Constants ----------------------------------------------------------------

const NO_TIMED_SYLLABLES: WordTiming[] = [];
Object.freeze(NO_TIMED_SYLLABLES);

// -- Views --------------------------------------------------------------------

interface CachedTracks {
  splitCharacter: string;
  main: LineTrack;
  background: LineTrack | undefined;
}

const tracksByLine = new WeakMap<LyricLine, CachedTracks>();
const timedByTrack = new WeakMap<LineTrack, WordTiming[]>();

function cachedTracks(line: LyricLine): CachedTracks {
  const splitCharacter = getSplitCharacter();
  const cached = tracksByLine.get(line);
  if (cached?.splitCharacter === splitCharacter) return cached;
  const [main, background] = tracksFromFields(line);
  timedByTrack.set(main, line.words ?? NO_TIMED_SYLLABLES);
  if (background) timedByTrack.set(background, line.backgroundWords ?? NO_TIMED_SYLLABLES);
  const tracks = { splitCharacter, main, background };
  tracksByLine.set(line, tracks);
  return tracks;
}

function mainTrack(line: LyricLine): LineTrack {
  return cachedTracks(line).main;
}

function backgroundTrack(line: LyricLine): LineTrack | undefined {
  return cachedTracks(line).background;
}

// -- Reads --------------------------------------------------------------------

function isTimedSyllable(syllable: Syllable): syllable is WordTiming {
  return syllable.begin !== undefined;
}

// The stored timed words themselves, never a copy, so identity checks and caches keyed on them still hold.
function timedSyllables(track: LineTrack | undefined): WordTiming[] {
  if (!track) return NO_TIMED_SYLLABLES;
  const cached = timedByTrack.get(track);
  if (cached) return cached;
  const timed = track.syllables.filter(isTimedSyllable);
  timedByTrack.set(track, timed);
  return timed;
}

// -- Exports ------------------------------------------------------------------

export { backgroundTrack, mainTrack, timedSyllables };

export type { LineTrack, Syllable, UntimedSyllable };
