import { withoutBackground, withRetypedBackground, withSeededBackground } from "./line-background";
import type { LyricLine } from "./line";
import { trackText } from "./line-text";
import { backgroundTrack } from "./line-track";
import { newBackgroundTrack, withBackgroundTrack, withTrackText } from "./line-track-writes";

// -- Functions ----------------------------------------------------------------

// The background a typed row shows becomes the line's background track. Retyped syllables keep their ids and timing
// the way main text does; a background typed in place is the user's own.
function withShownBackground(
  line: LyricLine,
  shown: string | null,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): LyricLine {
  const track = backgroundTrack(line);
  if (!shown) return track ? withoutBackground(line) : line;
  if (track && trackText(track, splitChar).trim() === shown) return line;
  if (!track) {
    const created = withTrackText(newBackgroundTrack(line.id, "manual"), shown, splitChar);
    return withSeededBackground(withBackgroundTrack(line, created), splitChar, songEnd);
  }
  return withRetypedBackground(line, shown, splitChar, songEnd);
}

// -- Exports ------------------------------------------------------------------

export { withShownBackground };
