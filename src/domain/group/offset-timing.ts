import { withReadingsOf } from "@/domain/language/pieces";
import type { LineTrack, LineUpdate, LyricLine } from "@/domain/line/model";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables } from "@/domain/line/track";
import {
  withMainTrack,
  withoutTrackTiming,
  withRoleTrack,
  withTrackSpan,
  withTrackWords,
} from "@/domain/line/track-writes";
import type { Bounds } from "@/domain/word/bounds";
import { withIdsOf } from "@/domain/word/id";
import type { WordTiming } from "@/domain/word/timing";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Timing fields ------------------------------------------------------------

function offsetWords(words: readonly WordTiming[] | undefined, offset: number, target?: readonly WordTiming[]) {
  return withIdsOf(
    words?.map((word) => ({ ...word, begin: word.begin + offset, end: word.end + offset })),
    target,
  );
}

function offsetTrack<T extends LineTrack>(source: LineTrack | undefined, offset: number, target: T): T {
  const words = offsetWords(timedSyllables(source), offset, timedSyllables(target));
  if (words?.length) return withTrackWords(target, words);
  if (source && isSpanTimed(source)) return withTrackSpan(target, source.begin + offset, source.end + offset);
  return withoutTrackTiming(target);
}

function offsetTiming(source: LyricLine, offset: number, target: LyricLine): LyricLine {
  const main = withMainTrack(target, offsetTrack(mainTrack(source), offset, mainTrack(target)));
  const sourceBackground = backgroundTrack(source);
  if (!backgroundTrack(main) && !timedSyllables(sourceBackground).length) return main;
  return withRoleTrack(main, "bg", (track) => offsetTrack(sourceBackground, offset, track));
}

// The copied syllables bring their readings, as words carrying them always did.
function offsetTimingFields(source: LyricLine, offset: number, target: LyricLine): LineUpdate["updates"] {
  const timed = offsetTiming(source, offset, target);
  const languages = withReadingsOf(timed, source);
  return {
    tracks: timed.tracks,
    languages: isStructurallyEqual(languages, target.languages) ? target.languages : languages,
  };
}

// -- Bounds -------------------------------------------------------------------

function updatedTimes(updates: LineUpdate["updates"]): Bounds[] {
  return (updates.tracks ?? []).flatMap((track) => {
    const span = isSpanTimed(track) ? [{ begin: track.begin, end: track.end }] : [];
    return [...span, ...timedSyllables(track)];
  });
}

function hasNegativeTime(updates: LineUpdate["updates"]): boolean {
  return updatedTimes(updates).some((time) => time.begin < 0);
}

function endsAfter(updates: LineUpdate["updates"], songEnd: number): boolean {
  return updatedTimes(updates).some((time) => time.end > songEnd);
}

// -- Exports ------------------------------------------------------------------

export { endsAfter, hasNegativeTime, offsetTimingFields };
