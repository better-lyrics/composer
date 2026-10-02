import { instanceBounds } from "@/domain/instance/bounds";
import { linesOfInstance } from "@/domain/instance/enumerate";
import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

function placementSkipTarget(
  lines: ReadonlyArray<LyricLine>,
  groupId: string,
  instanceIdx: number,
  tapTime: number,
  preroll: number,
): number | null {
  const bounds = instanceBounds(linesOfInstance(lines, groupId, instanceIdx));
  if (!bounds) return null;
  const target = bounds.end - preroll;
  return target > tapTime ? target : null;
}

// -- Exports ------------------------------------------------------------------

export { placementSkipTarget };
