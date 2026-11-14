import { withoutBackground, withSeededBackground } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { trackText } from "@/domain/line/text";
import { backgroundTrack } from "@/domain/line/track";
import { newBackgroundTrack, withBackgroundTrack, withTrackText } from "@/domain/line/track-writes";
import { classifyLine } from "@/utils/background-vocal-extraction";

// -- Functions ----------------------------------------------------------------

// The background a typed row shows becomes the line's background track. Retyped syllables keep their ids and timing
// the way main text does; a background typed in place, or shown beside new bracketed text that extraction will join to
// it, is the user's own.
function withShownBackground(line: LyricLine, shown: string | null, mainText: string, splitChar: string): LyricLine {
  const track = backgroundTrack(line);
  if (!shown) return track ? withoutBackground(line) : line;
  const joinsTypedGroups = classifyLine(mainText).kind === "inline";
  if (track && trackText(track, splitChar) === shown) {
    if (!joinsTypedGroups || track.source === "manual") return line;
    return withBackgroundTrack(line, { ...track, source: "manual" });
  }
  if (!track) {
    const created = withTrackText(newBackgroundTrack(line.id, "manual"), shown, splitChar);
    return withSeededBackground(withBackgroundTrack(line, created));
  }
  return withBackgroundTrack(line, { ...withTrackText(track, shown, splitChar), source: "manual" });
}

// -- Exports ------------------------------------------------------------------

export { withShownBackground };
