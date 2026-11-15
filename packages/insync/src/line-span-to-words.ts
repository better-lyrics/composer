import type { LineTrack, LyricLine } from "./line";
import { backgroundTrack, isSpanTimed, mainTrack } from "./line-track";
import { withBackgroundTrack, withMainTrack, withTrackSyllables } from "./line-track-writes";
import { lineTimingWordId } from "./word-id";

// -- Functions ----------------------------------------------------------------

// A line-synced track's syllables share its span evenly; the first takes the id its one drawn word had.
function spreadSpan<T extends LineTrack>(lineId: string, track: T): T {
  if (!isSpanTimed(track) || track.syllables.length === 0) return track;
  const wordDuration = (track.end - track.begin) / track.syllables.length;
  const words = track.syllables.map((syllable, i) => ({
    ...syllable,
    ...(i === 0 && { id: lineTimingWordId(lineId, track.role) }),
    begin: track.begin + i * wordDuration,
    end: track.begin + (i + 1) * wordDuration,
  }));
  return withTrackSyllables(track, words);
}

function convertMainToWord(line: LyricLine): LyricLine {
  return withMainTrack(line, spreadSpan(line.id, mainTrack(line)));
}

// Every line-synced track of the line becomes word synced; a background keeps its source.
function convertLineToWord(line: LyricLine): LyricLine {
  const background = backgroundTrack(line);
  return withBackgroundTrack(convertMainToWord(line), background && spreadSpan(line.id, background));
}

// Splitting a line-synced background into words is a user timing edit, so the track becomes manual.
function convertBackgroundToWord(line: LyricLine): LyricLine {
  const background = backgroundTrack(line);
  const spread = background && spreadSpan(line.id, background);
  return spread === background ? line : withBackgroundTrack(line, spread && { ...spread, source: "manual" });
}

// -- Exports ------------------------------------------------------------------

export { convertBackgroundToWord, convertLineToWord, convertMainToWord, spreadSpan };
