import type {
  BackgroundSource,
  BackgroundTrack,
  LineTrack,
  LyricLine,
  MainTrack,
  Syllable,
  TrackRole,
} from "@/domain/line/model";
import { syllablesFromText } from "@/domain/line/syllables-from-text";
import { backgroundTrack, isSpanTimed, isTimedSyllable, mainTrack, untimedSyllable } from "@/domain/line/track";
import { wordKey } from "@/domain/word/alignment";
import type { WordTiming } from "@/domain/word/timing";

// -- Tracks -------------------------------------------------------------------

function syllableTimed<T extends LineTrack>(track: T, syllables: readonly Syllable[]): T {
  const { begin: _begin, end: _end, ...rest } = track;
  return { ...rest, syllables } as T;
}

// Words added after the last one the track already had that spell the start of the untimed rest were timed from it.
function newlyTimedCount(known: ReadonlySet<string>, words: readonly WordTiming[], rest: readonly Syllable[]): number {
  const added = words.slice(words.findLastIndex((word) => known.has(word.id)) + 1);
  let count = Math.min(added.length, rest.length);
  const spells = (n: number) =>
    added.slice(added.length - n).every((word, index) => wordKey(word.text) === wordKey(rest[index].text));
  while (count > 0 && !spells(count)) count--;
  return count;
}

// Untimed syllables the words did not take stay after them; a span gives way to words that are none of its own.
function withTrackWords<T extends LineTrack>(track: T, words: readonly WordTiming[]): T {
  const own = new Set(track.syllables.map((syllable) => syllable.id));
  if (isSpanTimed(track) && !words.some((word) => own.has(word.id))) return syllableTimed(track, words);
  const taken = new Set(words.map((word) => word.id));
  const untaken = track.syllables.filter((syllable) => !isTimedSyllable(syllable) && !taken.has(syllable.id));
  const rest = untaken.slice(newlyTimedCount(own, words, untaken));
  return syllableTimed(track, rest.length === 0 ? words : [...words, ...rest]);
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

// Typed text replaces a track's syllables; a span stays when there is still text to time.
function withTrackText<T extends LineTrack>(track: T, text: string, splitChar?: string): T {
  const syllables = syllablesFromText(text, track, splitChar);
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

function withRoleWords(line: LyricLine, role: TrackRole, words: readonly WordTiming[]): LyricLine {
  return withRoleTrack(line, role, (track) => withTrackWords(track, words));
}

// -- Exports ------------------------------------------------------------------

export {
  newBackgroundTrack,
  withAgent,
  withBackgroundTrack,
  withMainTrack,
  withoutLineTiming,
  withoutTrackTiming,
  withRoleTrack,
  withRoleWords,
  withTrackSpan,
  withTrackSyllables,
  withTrackText,
  withTrackWords,
};
