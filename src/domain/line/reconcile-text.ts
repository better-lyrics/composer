import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { mainTrack } from "@/domain/line/track";
import { withMainTrack, withTrackText } from "@/domain/line/track-writes";

// The single chokepoint for re-deciding timing after a text edit: both the exact-match and position-match
// branches of textToLyricLines route through here so they cannot drift apart and clear timing on lines the
// user never touched.
function reconcileMatchedTiming(line: LyricLine, cleanedText: string): LyricLine {
  if (lineText(line) === cleanedText) return line;
  return withMainTrack(line, withTrackText(mainTrack(line), cleanedText));
}

export { reconcileMatchedTiming };
