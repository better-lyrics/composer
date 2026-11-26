import type { LyricLine } from "@/domain/line/model";
import { backgroundTrack, mainTrack } from "@/domain/line/track";

// -- Functions ----------------------------------------------------------------

function changedTrack<T>(line: LyricLine, latestFirst: readonly Partial<LyricLine>[], read: (line: LyricLine) => T): T {
  const original = read(line);
  for (const { tracks } of latestFirst) {
    if (!tracks) continue;
    const track = read({ ...line, tracks });
    if (track !== original) return track;
  }
  return original;
}

// Edits built from the same line that each replace their own track, joined so no track overwrites the other.
function combinedTrackEdits(line: LyricLine, edits: readonly Partial<LyricLine>[]): Partial<LyricLine> {
  const latestFirst = edits.toReversed();
  const main = changedTrack(line, latestFirst, mainTrack);
  const background = changedTrack(line, latestFirst, backgroundTrack);
  const joined: Partial<LyricLine> = Object.assign({}, ...edits);
  return { ...joined, tracks: background ? [main, background] : [main] };
}

// -- Exports ------------------------------------------------------------------

export { combinedTrackEdits };
