import type { LyricLine } from "@/domain/line/model";
import { mainTrack } from "@/domain/line/track";
import { withMainTrack } from "@/domain/line/track-writes";
import type { WordTiming } from "@/domain/word/timing";

// -- Functions ----------------------------------------------------------------

// The main-word funnel: the words become the whole main track, so their text is the line's text.
function mainWordEditFields(line: LyricLine, words: readonly WordTiming[]): Partial<LyricLine> {
  const { begin: _begin, end: _end, ...main } = mainTrack(line);
  return { tracks: withMainTrack(line, { ...main, syllables: words }).tracks };
}

// -- Exports ------------------------------------------------------------------

export { mainWordEditFields };
