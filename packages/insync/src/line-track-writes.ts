import type { BackgroundSource, BackgroundTrack, LineTrack, LyricLine, MainTrack, Syllable, TrackRole } from "./line";
import { syllablesFromText } from "./line-syllables-from-text";
import {
  backgroundTrack,
  isExplicitBlock,
  isSpanTimed,
  isTimedSyllable,
  mainTrack,
  untimedSyllable,
} from "./line-track";
import type { WordTiming } from "./word-timing";
import { endedWord } from "./word-syllable-groups";

// -- Tracks -------------------------------------------------------------------

function syllableTimed<T extends LineTrack>(track: T, syllables: readonly Syllable[]): T {
  const { begin: _begin, end: _end, ...rest } = track;
  return { ...rest, syllables } as T;
}

// The last timed syllable before the untimed rest keeps the join it had to that same syllable; any other one there
// ends its word, so the two never run together.
function seamBeforeUntimed(track: LineTrack, last: WordTiming, next: Syllable): WordTiming {
  const at = track.syllables.findIndex((syllable) => syllable.id === last.id);
  const own = track.syllables[at];
  if (at < 0 || track.syllables[at + 1]?.id !== next.id) return last.sep && !last.joinsNext ? last : endedWord(last);
  return last.sep || last.joinsNext ? last : { ...last, sep: own.sep, joinsNext: own.joinsNext };
}

function withEndedTrack<S extends Syllable>(syllables: readonly S[]): readonly S[] {
  const last = syllables.at(-1);
  return last?.joinsNext ? [...syllables.slice(0, -1), { ...last, joinsNext: false }] : syllables;
}

// Timed syllables joined back to the untimed rest, and the last syllable of the track joining nothing.
function joinedSyllables(track: LineTrack, words: readonly WordTiming[], untaken: readonly Syllable[]) {
  const last = words.at(-1);
  if (!last || untaken.length === 0) return withEndedTrack(untaken.length === 0 ? words : untaken);
  return withEndedTrack([...words.slice(0, -1), seamBeforeUntimed(track, last, untaken[0]), ...untaken]);
}

// Untimed syllables the words did not take stay after them; a span gives way to words that are none of its own.
function withTrackWords<T extends LineTrack>(track: T, words: readonly WordTiming[]): T {
  const own = new Set(track.syllables.map((syllable) => syllable.id));
  if (isSpanTimed(track) && !words.some((word) => own.has(word.id))) return syllableTimed(track, withEndedTrack(words));
  const taken = new Set(words.map((word) => word.id));
  const untaken = track.syllables.filter((syllable) => !isTimedSyllable(syllable) && !taken.has(syllable.id));
  return syllableTimed(track, joinedSyllables(track, words, untaken));
}

// The block of a span is explicit when every syllable is; a mark on the block marks or clears them all.
function withTrackExplicit<T extends LineTrack>(track: T, explicit: boolean): T {
  if (track.syllables.every((syllable) => (syllable.explicit === true) === explicit)) return track;
  const syllables = track.syllables.map(({ explicit: _explicit, ...syllable }) =>
    explicit ? { ...syllable, explicit: true as const } : syllable,
  );
  return { ...track, syllables } as T;
}

// A timing write: one syllable sets a span track's edges, so a line-synced track stays line synced.
function trackTimingWrite<T extends LineTrack>(track: T, syllables: readonly WordTiming[]): T {
  if (isSpanTimed(track) && syllables.length === 1) {
    const [block] = syllables;
    const marked =
      (block.explicit === true) === isExplicitBlock(track) ? track : withTrackExplicit(track, !!block.explicit);
    return withTrackSpan(marked, block.begin, block.end);
  }
  return withTrackWords(track, syllables);
}

function withTrackSyllables<T extends LineTrack>(track: T, syllables: readonly Syllable[]): T {
  return syllableTimed(track, syllables);
}

function withTrackSpan<T extends LineTrack>(track: T, begin: number, end: number): T {
  return { ...track, syllables: track.syllables.map(untimedSyllable), begin, end };
}

function withoutTrackTiming<T extends LineTrack>(track: T): T {
  return syllableTimed(track, track.syllables.map(untimedSyllable));
}

// Typed text replaces a track's syllables; a span stays when there is still text to time. Timing stays before `limit`.
function withTrackText<T extends LineTrack>(
  track: T,
  text: string,
  splitChar: string,
  limit = Number.POSITIVE_INFINITY,
): T {
  const syllables = syllablesFromText(text, track, splitChar, limit);
  if (isSpanTimed(track) && syllables.length > 0) {
    return { ...track, syllables: syllables.map(untimedSyllable) };
  }
  return syllableTimed(track, syllables);
}

function newBackgroundTrack(lineId: string, source?: BackgroundSource): BackgroundTrack {
  return { id: `${lineId}:bg`, role: "bg", syllables: [], ...(source && { source }) };
}

// -- Lines --------------------------------------------------------------------

function withMainTrack(line: LyricLine, main: MainTrack): LyricLine {
  if (main === mainTrack(line)) return line;
  const background = backgroundTrack(line);
  return { ...line, tracks: background ? [main, background] : [main] };
}

function withBackgroundTrack(line: LyricLine, background: BackgroundTrack | undefined): LyricLine {
  if (background === backgroundTrack(line)) return line;
  return { ...line, tracks: background ? [mainTrack(line), background] : [mainTrack(line)] };
}

function withAgent(line: LyricLine, agentId: string): LyricLine {
  const main = mainTrack(line);
  return main.agentId === agentId ? line : withMainTrack(line, { ...main, agentId });
}

function withRoleTrack(line: LyricLine, role: TrackRole, write: <T extends LineTrack>(track: T) => T): LyricLine {
  if (role === "main") return withMainTrack(line, write(mainTrack(line)));
  return withBackgroundTrack(line, write(backgroundTrack(line) ?? newBackgroundTrack(line.id)));
}

function withoutLineTiming(line: LyricLine): LyricLine {
  const background = backgroundTrack(line);
  return withBackgroundTrack(
    withMainTrack(line, withoutTrackTiming(mainTrack(line))),
    background && withoutTrackTiming(background),
  );
}

function mainTimingWrite(line: LyricLine, syllables: readonly WordTiming[]): Partial<LyricLine> {
  return { tracks: withMainTrack(line, trackTimingWrite(mainTrack(line), syllables)).tracks };
}

// An edit that keeps a line-synced main track line synced, or null when it would give it more than one syllable.
function mainTimingEdit(line: LyricLine, syllables: readonly WordTiming[]): Partial<LyricLine> | null {
  return isSpanTimed(mainTrack(line)) && syllables.length !== 1 ? null : mainTimingWrite(line, syllables);
}

function withRoleWords(line: LyricLine, role: TrackRole, words: readonly WordTiming[]): LyricLine {
  return withRoleTrack(line, role, (track) => withTrackWords(track, words));
}

// Timed syllables the words leave out stay in the track untimed, where `withRoleWords` would drop them.
function withRoleWordsUntimingRest(line: LyricLine, role: TrackRole, words: readonly WordTiming[]): LyricLine {
  const taken = new Set(words.map((word) => word.id));
  const leftOut = (syllable: Syllable) => isTimedSyllable(syllable) && !taken.has(syllable.id);
  return withRoleTrack(line, role, (track) => {
    if (!track.syllables.some(leftOut)) return withTrackWords(track, words);
    const syllables = track.syllables.map((syllable) => (leftOut(syllable) ? untimedSyllable(syllable) : syllable));
    return withTrackWords(syllableTimed(track, syllables), words);
  });
}

function backgroundTimingWrite(line: LyricLine, syllables: readonly WordTiming[]): Partial<LyricLine> {
  return { tracks: withRoleTrack(line, "bg", (track) => trackTimingWrite(track, syllables)).tracks };
}

// -- Exports ------------------------------------------------------------------

export {
  backgroundTimingWrite,
  mainTimingEdit,
  mainTimingWrite,
  newBackgroundTrack,
  trackTimingWrite,
  withAgent,
  withBackgroundTrack,
  withEndedTrack,
  withMainTrack,
  withoutLineTiming,
  withoutTrackTiming,
  withRoleTrack,
  withRoleWords,
  withRoleWordsUntimingRest,
  withTrackExplicit,
  withTrackSpan,
  withTrackSyllables,
  withTrackText,
  withTrackWords,
};
