import {
  type LineageCounterpart,
  type LineRoom,
  lineageByLetters,
  lineageByText,
  syllableLineage,
  targetId,
} from "insync/group-syllable-lineage";
import { withAlignedWords } from "insync/language-align";
import { regroupedLanguages, withOwnPieces } from "insync/language-pieces";
import { withSeededBackground } from "@/domain/line/background";
import type { BackgroundTrack, LineTrack, LineTracks, LyricLine, MainTrack, Syllable } from "insync/line";
import {
  backgroundTrack,
  isSpanTimed,
  isTimedSyllable,
  mainTrack,
  timedSyllables,
  untimedSyllable,
} from "insync/line-track";
import { newBackgroundTrack, withTrackSpan, withTrackSyllables } from "@/domain/line/track-writes";
import { isStructurallyEqual } from "insync/structural-equal";

// -- Content ------------------------------------------------------------------

function sameSyllableContent(a: readonly Syllable[], b: readonly Syllable[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) {
    const x = a[index];
    const y = b[index];
    if (x.text !== y.text || x.sep !== y.sep || x.joinsNext !== y.joinsNext || x.explicit !== y.explicit) return false;
  }
  return true;
}

// What a group line gives every instance: the syllables' text, separators, joins and marks, the singer, and the
// background and where it came from. Timing, ids and readings are each instance's own.
function sameSharedContent(a: LyricLine, b: LyricLine): boolean {
  const [aMain, aBackground] = a.tracks;
  const [bMain, bBackground] = b.tracks;
  if (aMain.agentId !== bMain.agentId || !sameSyllableContent(aMain.syllables, bMain.syllables)) return false;
  if (!aBackground || !bBackground) return aBackground === bBackground;
  return aBackground.source === bBackground.source && sameSyllableContent(aBackground.syllables, bBackground.syllables);
}

// -- Tracks -------------------------------------------------------------------

const sameIds = (a: readonly Syllable[], b: readonly Syllable[]) =>
  a.length === b.length && a.every((syllable, index) => syllable.id === b[index].id);

function shifted(syllables: readonly Syllable[], offset: number, counterpart: LineageCounterpart): Syllable[] {
  return syllables.map((syllable) => {
    const id = targetId(counterpart, syllable.id);
    return isTimedSyllable(syllable)
      ? { ...syllable, id, begin: syllable.begin + offset, end: syllable.end + offset }
      : { ...syllable, id };
  });
}

// Same syllables as before the edit: each keeps the other instance's id and time where it stood.
function inPlace(syllables: readonly Syllable[], counterpart: LineageCounterpart): Syllable[] {
  let timedRun = true;
  return syllables.map((syllable) => {
    const target = counterpart(syllable.id)?.target;
    const id = target?.id ?? targetId(counterpart, syllable.id);
    if (timedRun && target && isTimedSyllable(target)) return { ...syllable, id, begin: target.begin, end: target.end };
    timedRun = false;
    return { ...untimedSyllable(syllable), id };
  });
}

// An instance whose syllables already differed from the edited one, and do not spell the same letters, takes the
// edit spread over its own bounds.
function proportional(
  syllables: readonly Syllable[],
  from: readonly [number, number] | undefined,
  to: readonly [number, number] | undefined,
  counterpart: LineageCounterpart,
): Syllable[] {
  if (!from || !to || from[1] <= from[0]) {
    return syllables.map((syllable) => ({ ...untimedSyllable(syllable), id: targetId(counterpart, syllable.id) }));
  }
  const scale = (to[1] - to[0]) / (from[1] - from[0]);
  const at = (time: number) => Math.round((to[0] + (time - from[0]) * scale) * 1e9) / 1e9;
  return syllables.map((syllable) => {
    const id = targetId(counterpart, syllable.id);
    return isTimedSyllable(syllable)
      ? { ...syllable, id, begin: at(syllable.begin), end: at(syllable.end) }
      : { ...syllable, id };
  });
}

function boundsOf(track: LineTrack | undefined): readonly [number, number] | undefined {
  if (!track) return undefined;
  if (isSpanTimed(track)) return [track.begin, track.end];
  const timed = timedSyllables(track);
  return timed.length ? [timed[0].begin, timed[timed.length - 1].end] : undefined;
}

interface TrackCarry {
  before: LineTrack | undefined;
  after: LineTrack;
  own: LineTrack | undefined;
  offset: number | null;
  counterpart: LineageCounterpart;
  // Syllables the edit added before or after the instance's own stay in this room.
  room: LineRoom;
  splitChar: string;
}

// The edited track's content on the other instance's track: on the shared timing when the two share it, else on that
// instance's own timing through the syllables' lineage. A line-synced track keeps its span.
function carriedTrackTiming({ before, after, own, offset, counterpart, room, splitChar }: TrackCarry) {
  if (offset !== null) {
    const span = isSpanTimed(after) ? ([after.begin + offset, after.end + offset] as const) : undefined;
    return { syllables: shifted(after.syllables, offset, counterpart), span };
  }
  const span = own && isSpanTimed(own) ? boundsOf(own) : undefined;
  if (span) return { syllables: inPlace(after.syllables, counterpart).map(untimedSyllable), span };
  if (isSpanTimed(after)) {
    const timed = own && timedSyllables(own).length > 0;
    const syllables = timed
      ? lineageByText(after.syllables, own.syllables, counterpart, splitChar, room)
      : inPlace(after.syllables, counterpart);
    return { syllables, span: undefined };
  }
  if (before && own && !sameSyllableContent(before.syllables, own.syllables)) {
    const syllables =
      lineageByLetters(after.syllables, own.syllables, counterpart) ??
      proportional(after.syllables, boundsOf(after), boundsOf(own), counterpart);
    return { syllables, span: undefined };
  }
  const kept = before && sameIds(before.syllables, after.syllables);
  const syllables = kept
    ? inPlace(after.syllables, counterpart)
    : syllableLineage(before?.syllables ?? [], after.syllables, counterpart, room);
  return { syllables, span: undefined };
}

function withTiming<T extends LineTrack>(track: T, timing: ReturnType<typeof carriedTrackTiming>): T {
  const written = withTrackSyllables(track, timing.syllables);
  return timing.span ? withTrackSpan(written, timing.span[0], timing.span[1]) : written;
}

// -- Languages ----------------------------------------------------------------

// The edit's language fields when it changed them; each instance's own readings, regrouped the way its syllables
// were, so a merge joins that instance's readings and a split keeps them on the syllables they were on.
function carriedLanguages(before: LyricLine, after: LyricLine, own: LyricLine, tracks: LineTracks, splitChar: string) {
  const fieldsChanged = !isStructurallyEqual(withOwnPieces(before.languages, own), withOwnPieces(after.languages, own));
  let languages = fieldsChanged ? withOwnPieces(after.languages, own) : own.languages;
  if (!languages) return undefined;
  const aligned = withAlignedWords(own, splitChar);
  for (const [index, track] of tracks.entries()) {
    const was = timedSyllables(own.tracks[index]);
    const now = timedSyllables(track);
    if (sameIds(was, now)) continue;
    languages = regroupedLanguages({ ...own, languages }, aligned, track.role, was, now);
  }
  return languages;
}

// -- Functions ----------------------------------------------------------------

interface LineCarry {
  before: LyricLine;
  after: LyricLine;
  own: LyricLine;
  offset: number | null;
  counterpart: LineageCounterpart;
  room: LineRoom;
  splitChar: string;
}

// Another instance's line after an edit to its template line: the edit's content, that instance's own timing and
// ids, and its readings unless the edit rewrote them.
function carriedLine({ before, after, own, offset, counterpart, room, splitChar }: LineCarry): LyricLine {
  const ownMain = mainTrack(own);
  const afterMain = mainTrack(after);
  const main: MainTrack = withTiming(
    { ...ownMain, agentId: afterMain.agentId },
    carriedTrackTiming({
      before: mainTrack(before),
      after: afterMain,
      own: ownMain,
      offset,
      counterpart,
      room,
      splitChar,
    }),
  );
  const afterBackground = backgroundTrack(after);
  const ownBackground = backgroundTrack(own);
  const backgroundBase: BackgroundTrack = ownBackground ?? newBackgroundTrack(own.id);
  const background =
    afterBackground &&
    withTiming(
      afterBackground.source ? { ...backgroundBase, source: afterBackground.source } : backgroundBase,
      carriedTrackTiming({
        before: backgroundTrack(before),
        after: afterBackground,
        own: ownBackground,
        offset,
        counterpart,
        room,
        splitChar,
      }),
    );
  const tracks: LineTracks = background ? [main, background] : [main];
  const languages = carriedLanguages(before, after, own, tracks, splitChar);
  const { languages: _languages, ...rest } = own;
  return withSeededBackground({ ...rest, tracks, ...(languages && { languages }) }, splitChar);
}

// -- Exports ------------------------------------------------------------------

export { carriedLine, sameSharedContent };
