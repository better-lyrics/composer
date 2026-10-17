import { instanceBounds } from "@/domain/instance/bounds";
import { linesOfInstance } from "@/domain/instance/enumerate";
import type { LyricLine } from "@/domain/line/model";

// -- Interfaces ---------------------------------------------------------------

interface PlacementSkip {
  seekTo: number;
  end: number;
}

// -- Functions ----------------------------------------------------------------

function placementSkipTarget(
  lines: ReadonlyArray<LyricLine>,
  groupId: string,
  instanceIdx: number,
  tapTime: number,
  preroll: number,
): PlacementSkip | null {
  const bounds = instanceBounds(linesOfInstance(lines, groupId, instanceIdx));
  if (!bounds) return null;
  const seekTo = bounds.end - preroll;
  return seekTo > tapTime ? { seekTo, end: bounds.end } : null;
}

// -- Exports ------------------------------------------------------------------

export { placementSkipTarget };
export type { PlacementSkip };
