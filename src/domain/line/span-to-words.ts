import type { LyricLine } from "@/domain/line/model";
import { isSpanTimed, mainTrack } from "@/domain/line/track";
import { withMainTrack, withTrackSyllables } from "@/domain/line/track-writes";
import { lineTimingWordId } from "@/domain/word/id";

// -- Functions ----------------------------------------------------------------

// A line-synced line's syllables share its span evenly; the first takes the id its one drawn word had.
function convertLineToWord(line: LyricLine): LyricLine {
  const main = mainTrack(line);
  if (!isSpanTimed(main) || main.syllables.length === 0) return line;
  const wordDuration = (main.end - main.begin) / main.syllables.length;
  const words = main.syllables.map((syllable, i) => ({
    ...syllable,
    ...(i === 0 && { id: lineTimingWordId(line.id) }),
    begin: main.begin + i * wordDuration,
    end: main.begin + (i + 1) * wordDuration,
  }));
  return withMainTrack(line, withTrackSyllables(main, words));
}

// -- Exports ------------------------------------------------------------------

export { convertLineToWord };
