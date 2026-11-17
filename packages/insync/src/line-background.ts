import { effectiveBounds } from "./line-bounds";
import { syllablesFromFields } from "./line-from-fields";
import type { BackgroundSource, BackgroundTrack, LyricLine } from "./line";
import { backgroundText } from "./line-text";
import { isLineSynced } from "./line-predicates";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables, untimedSyllable } from "./line-track";
import {
  newBackgroundTrack,
  trackTimingWrite,
  withBackgroundTrack,
  withEndedTrack,
  withTrackSpan,
  withTrackSyllables,
  withTrackText,
  withoutTrackTiming,
} from "./line-track-writes";
import type { WordTiming } from "./word-timing";
import { createInitialBgSpan, createInitialBgWords } from "./lyric-words";

// -- Types --------------------------------------------------------------------

interface BackgroundParams {
  text?: string;
  words?: readonly WordTiming[];
  source: BackgroundSource;
}

// -- Funnel -------------------------------------------------------------------

// The single chokepoint for writing a line's background track. Keeps its syllables and the source
// provenance flag coherent so the flag can never drift: an empty write drops the track. A rewritten track keeps
// what the old one carried from its TTML.
function backgroundTrackFrom(
  line: LyricLine,
  params: BackgroundParams,
  splitChar: string,
): BackgroundTrack | undefined {
  const text = params.text && params.text.trim().length > 0 ? params.text : undefined;
  const words = params.words && params.words.length > 0 ? [...params.words] : undefined;
  if (!text && !words) return undefined;
  const syllables = syllablesFromFields(text ?? "", words, splitChar);
  const passthrough = backgroundTrack(line)?.passthrough;
  const track = newBackgroundTrack(line.id, params.source);
  return withTrackSyllables(passthrough ? { ...track, passthrough } : track, syllables);
}

function withBackground(line: LyricLine, params: BackgroundParams, splitChar: string): LyricLine {
  return withBackgroundTrack(line, backgroundTrackFrom(line, params, splitChar));
}

function withoutBackground(line: LyricLine): LyricLine {
  return withBackgroundTrack(line, undefined);
}

// Any timeline edit of a line's background words (retime, split, merge, add, delete, drag) is manual
// curation: a re-paste or re-extraction must not silently overwrite it. The untimed rest stays, and the one
// block of a line-synced background moves its span.
function withManualBackgroundWords(line: LyricLine, words: readonly WordTiming[], splitChar: string): LyricLine {
  const background = backgroundTrack(line);
  if (!background) return withBackground(line, { words: withEndedTrack(words), source: "manual" }, splitChar);
  const written = trackTimingWrite(background, words);
  return withBackgroundTrack(line, written.syllables.length > 0 ? { ...written, source: "manual" } : undefined);
}

function secondHalf(line: LyricLine): { begin: number; end?: number } | null {
  const bounds = effectiveBounds(line);
  return bounds && bounds.end > bounds.begin ? { begin: (bounds.begin + bounds.end) / 2, end: bounds.end } : null;
}

// The one seeding of untimed background lyrics: syllables keep their ids when the seeded words match them, and a
// span track takes the seeded words' bounds. A background that has any timing is never seeded.
function seededBackground(
  line: LyricLine,
  span: { begin: number; end?: number; songEnd?: number } | null,
  splitChar: string,
  asSpan = isSpanTimed(mainTrack(line)),
): LyricLine {
  const background = backgroundTrack(line);
  const text = backgroundText(line, splitChar);
  if (!background || !text || !span || isSpanTimed(background) || timedSyllables(background).length > 0) return line;
  if (asSpan) {
    const seededSpan = createInitialBgSpan(text, span.begin, span.end, splitChar, span.songEnd);
    return seededSpan ? withBackgroundTrack(line, withTrackSpan(background, seededSpan.begin, seededSpan.end)) : line;
  }
  const words = createInitialBgWords(text, span.begin, span.end, splitChar, span.songEnd);
  if (words.length === 0) return line;
  const untimed = background.syllables.map(untimedSyllable);
  const seeded =
    words.length === untimed.length
      ? words.map((word, index) => ({ ...untimed[index], begin: word.begin, end: word.end }))
      : words;
  return withBackgroundTrack(line, withTrackSyllables(background, seeded));
}

// A line with no length yet, as a Line mode tap leaves it, seeds from its begin the way the tap seeds.
function seedSpan(line: LyricLine, songEnd: number): { begin: number; end?: number; songEnd?: number } | null {
  const bounds = effectiveBounds(line);
  if (bounds && bounds.end === bounds.begin) return { begin: bounds.begin, songEnd };
  const half = secondHalf(line);
  return half && { ...half, songEnd };
}

// Untimed background lyrics are timed over the second half of a timed line, at the main track's sync level. An open
// line's background ends by the song's end, unbounded when not given.
function withSeededBackground(line: LyricLine, splitChar: string, songEnd = Number.POSITIVE_INFINITY): LyricLine {
  return seededBackground(line, seedSpan(line, songEnd), splitChar);
}

// Seeded as words whatever the main track's level, as 3.x seeded every line: for joining background words that
// carry their own timing, and for reading a record the way 3.x opened it.
function withSeededBackgroundWords(line: LyricLine, splitChar: string): LyricLine {
  return seededBackground(line, secondHalf(line), splitChar, false);
}

// Untimed background lyrics are timed from where the line's first syllable was tapped, ending by the song's end.
function withBackgroundSeededFrom(line: LyricLine, begin: number, songEnd: number, splitChar: string): LyricLine {
  return seededBackground(line, { begin, songEnd }, splitChar);
}

// Retyped background text keeps its timing the way main text does, before the song's end; a background may run past the
// main track and over the next line. On a line-synced line a background never goes partly untimed: where the song end
// leaves no room for the typed words, it is seeded again whole.
function withRetypedBackground(line: LyricLine, text: string, splitChar: string, songEnd: number): LyricLine {
  const background = backgroundTrack(line);
  if (!background) return line;
  const retyped = { ...withTrackText(background, text, splitChar, songEnd), source: "manual" as const };
  if (!isLineSynced(line) || isSpanTimed(retyped)) return withBackgroundTrack(line, retyped);
  const unbounded = withTrackText(background, text, splitChar);
  if (timedSyllables(retyped).length >= timedSyllables(unbounded).length) return withBackgroundTrack(line, retyped);
  const untimed = withTrackSyllables(retyped, retyped.syllables.map(untimedSyllable));
  return withSeededBackground(withBackgroundTrack(line, untimed), splitChar, songEnd);
}

// A timed background whose timing is not what seeding gives its text was timed by hand, so new text keeps that timing.
function keepsBackgroundTiming(line: LyricLine, splitChar: string, songEnd = Number.POSITIVE_INFINITY): boolean {
  const background = backgroundTrack(line);
  if (!background || (!isSpanTimed(background) && timedSyllables(background).length === 0)) return false;
  const untimed = withBackgroundTrack(line, withoutTrackTiming(background));
  const seeded = backgroundTrack(withSeededBackground(untimed, splitChar, songEnd));
  return !seeded || trackTimes(seeded) !== trackTimes(background);
}

function trackTimes(track: BackgroundTrack): string {
  return JSON.stringify([track.begin, track.end, track.syllables.map((syllable) => [syllable.begin, syllable.end])]);
}

// -- Exports ------------------------------------------------------------------

export {
  keepsBackgroundTiming,
  withRetypedBackground,
  withBackground,
  withBackgroundSeededFrom,
  withManualBackgroundWords,
  withSeededBackground,
  withSeededBackgroundWords,
  withoutBackground,
};
export type { BackgroundSource, BackgroundParams };
