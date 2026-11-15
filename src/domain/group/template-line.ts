import type { OwnTiming, SpanTimes, TemplateLine } from "insync/group";
import { instanceBounds } from "@/domain/instance/bounds";
import type { LineTrack, LineTracks, LyricLine, Syllable } from "insync/line";
import { isSpanTimed, isTimedSyllable, untimedSyllable } from "insync/line-track";

// -- Types --------------------------------------------------------------------

type LineContent = Omit<LyricLine, "groupId" | "instanceIdx" | "templateLineIdx" | "detached">;

// -- Tracks -------------------------------------------------------------------

function withTracks<T extends LineContent>(line: T, write: <K extends LineTrack>(track: K) => K): T {
  const [main, background] = line.tracks;
  const tracks: LineTracks = background ? [write(main), write(background)] : [write(main)];
  return { ...line, tracks };
}

function spanOf(track: LineTrack): SpanTimes | undefined {
  return isSpanTimed(track) ? [track.begin, track.end] : undefined;
}

function retimedTrack<T extends LineTrack>(track: T, delta: number): T {
  if (isSpanTimed(track)) return { ...track, begin: track.begin + delta, end: track.end + delta };
  const syllables = track.syllables.map((syllable: Syllable) =>
    isTimedSyllable(syllable) ? { ...syllable, begin: syllable.begin + delta, end: syllable.end + delta } : syllable,
  );
  return { ...track, syllables };
}

function untimedTrack<T extends LineTrack>(track: T): T {
  const { begin: _begin, end: _end, ...rest } = track;
  const syllables: readonly Syllable[] = track.syllables.map(untimedSyllable);
  return { ...rest, syllables } as T;
}

function ownTimedTrack<T extends LineTrack>(track: T, timing: OwnTiming): T {
  const untimed = untimedTrack(track);
  const span = timing.tracks?.[track.id];
  if (span) return { ...untimed, begin: span[0], end: span[1] };
  const syllables = untimed.syllables.map((syllable: Syllable) => {
    const times = timing.syllables[syllable.id];
    return times ? { ...syllable, begin: times[0], end: times[1] } : syllable;
  });
  return { ...untimed, syllables };
}

// -- Lines --------------------------------------------------------------------

function lineContent({ groupId: _g, instanceIdx: _i, templateLineIdx: _t, detached: _d, ...line }: LyricLine) {
  return line;
}

// Times move by exactly `delta`, never clamped, so a line taken to its template and back is the same line.
function retimedLine<T extends LineContent>(line: T, delta: number): T {
  return delta === 0 ? line : withTracks(line, (track) => retimedTrack(track, delta));
}

function untimedLine<T extends LineContent>(line: T): T {
  return withTracks(line, untimedTrack);
}

function ownTimedLine<T extends LineContent>(line: T, timing: OwnTiming): T {
  return withTracks(line, (track) => ownTimedTrack(track, timing));
}

function ownTimingOf(lines: readonly LineContent[]): OwnTiming {
  const syllables: Record<string, SpanTimes> = {};
  const tracks: Record<string, SpanTimes> = {};
  for (const track of lines.flatMap((line) => line.tracks)) {
    const span = spanOf(track);
    if (span) tracks[track.id] = span;
    for (const syllable of track.syllables) {
      if (isTimedSyllable(syllable)) syllables[syllable.id] = [syllable.begin, syllable.end];
    }
  }
  return Object.keys(tracks).length ? { syllables, tracks } : { syllables };
}

// Where the template sits for the instance's first template line, in slot order, that is timed in both, so an
// instance missing a template line, or holding its own, still anchors on the lines it has.
function fittedAnchor(slots: readonly { template: TemplateLine; content: LineContent }[]): number | undefined {
  let fitted: { slot: number; anchor: number } | undefined;
  for (const { template, content } of slots) {
    if (fitted && fitted.slot < template.slot) continue;
    const own = instanceBounds([content]);
    const relative = instanceBounds([templateContent(template)]);
    if (own && relative) fitted = { slot: template.slot, anchor: own.begin - relative.begin };
  }
  return fitted?.anchor;
}

function toTemplateLine(line: LyricLine, slot: number, at: number | undefined): TemplateLine {
  return { ...retimedLine(lineContent(line), at === undefined ? 0 : -at), slot };
}

function templateContent({ slot: _slot, ...line }: TemplateLine): LineContent {
  return line;
}

// -- Exports ------------------------------------------------------------------

export type { LineContent };
export {
  fittedAnchor,
  lineContent,
  ownTimedLine,
  ownTimingOf,
  retimedLine,
  templateContent,
  toTemplateLine,
  untimedLine,
};
