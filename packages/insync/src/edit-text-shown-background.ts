import { withoutBackground, withSeededBackground } from "./line-background";
import type { LyricLine, MainTrack } from "./line";
import { trackText } from "./line-text";
import { backgroundTrack, mainTrack } from "./line-track";
import { newBackgroundTrack, withBackgroundTrack, withTrackText } from "./line-track-writes";
import { classifyLine } from "./background-vocal-extraction";
import { memoBySplitCharacter } from "./memo-by-identity";

// -- Functions ----------------------------------------------------------------

// Whether the main text holds bracketed text extraction would add to the background; read once per main track.
const typedGroupsOfMain = memoBySplitCharacter(
  (main: MainTrack, splitChar: string) => classifyLine(trackText(main, splitChar)).kind === "inline",
);

function hasTypedGroups(line: LyricLine, splitChar: string): boolean {
  return typedGroupsOfMain(mainTrack(line), splitChar);
}

// The background a typed row shows becomes the line's background track. Retyped syllables keep their ids and timing
// the way main text does; a background typed in place, or shown beside new bracketed text that extraction will join to
// it, is the user's own.
function withShownBackground(line: LyricLine, shown: string | null, splitChar: string): LyricLine {
  const track = backgroundTrack(line);
  if (!shown) return track ? withoutBackground(line) : line;
  if (track && trackText(track, splitChar).trim() === shown) {
    if (track.source === "manual" || !hasTypedGroups(line, splitChar)) return line;
    return withBackgroundTrack(line, { ...track, source: "manual" });
  }
  if (!track) {
    const created = withTrackText(newBackgroundTrack(line.id, "manual"), shown, splitChar);
    return withSeededBackground(withBackgroundTrack(line, created), splitChar);
  }
  return withBackgroundTrack(line, { ...withTrackText(track, shown, splitChar), source: "manual" });
}

// -- Exports ------------------------------------------------------------------

export { withShownBackground };
