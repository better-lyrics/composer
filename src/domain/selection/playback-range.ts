import { wholeSongRange } from "@/domain/group/shared-timing";
import type { Bounds } from "@/domain/word/bounds";

// -- Types --------------------------------------------------------------------

interface PlaybackRangeSources {
  region: Bounds | null;
  selection: Bounds | null;
  focus: Bounds | null;
  leadIn: number;
  duration: number;
}

// -- Functions ----------------------------------------------------------------

function playbackRange({ region, selection, focus, leadIn, duration }: PlaybackRangeSources): Bounds | null {
  if (region) return region;
  if (!selection) return focus;
  const song = wholeSongRange(duration);
  return { begin: Math.max(song.min, selection.begin - leadIn), end: Math.min(song.max, selection.end + leadIn) };
}

// -- Exports ------------------------------------------------------------------

export { playbackRange };
