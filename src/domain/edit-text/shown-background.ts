import { withoutBackground, withSeededBackground } from "@/domain/line/background";
import type { LyricLine, MainTrack } from "insync/line";
import { trackText } from "@/domain/line/text";
import { backgroundTrack, mainTrack } from "insync/line-track";
import { newBackgroundTrack, withBackgroundTrack, withTrackText } from "@/domain/line/track-writes";
import { classifyLine } from "@/utils/background-vocal-extraction";

// -- Functions ----------------------------------------------------------------

const typedGroupsByMain = new WeakMap<MainTrack, boolean>();

// Whether the main text holds bracketed text extraction would add to the background; read once per main track.
function hasTypedGroups(line: LyricLine, splitChar: string): boolean {
  const main = mainTrack(line);
  const cached = typedGroupsByMain.get(main);
  if (cached !== undefined) return cached;
  const typed = classifyLine(trackText(main, splitChar)).kind === "inline";
  typedGroupsByMain.set(main, typed);
  return typed;
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
    return withSeededBackground(withBackgroundTrack(line, created));
  }
  return withBackgroundTrack(line, { ...withTrackText(track, shown, splitChar), source: "manual" });
}

// -- Exports ------------------------------------------------------------------

export { withShownBackground };
