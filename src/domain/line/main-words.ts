import type { LyricLine } from "@/domain/line/model";
import { mainTrack } from "@/domain/line/track";
import { withMainTrack, withTrackWords } from "@/domain/line/track-writes";
import type { WordTiming } from "@/domain/word/timing";

// -- Functions ----------------------------------------------------------------

// The main-word funnel: the words become the timed part of the main track; its untimed rest stays.
function mainWordEditFields(line: LyricLine, words: readonly WordTiming[]): Partial<LyricLine> {
  return { tracks: withMainTrack(line, withTrackWords(mainTrack(line), words)).tracks };
}

// -- Exports ------------------------------------------------------------------

export { mainWordEditFields };
