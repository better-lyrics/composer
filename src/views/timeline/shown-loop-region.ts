import type { Bounds } from "@/domain/word/bounds";
import type { LoopRegion } from "@/domain/selection/loop-region";
import type { LoopRegionDrag } from "@/views/timeline/timeline-store";

// -- Functions -----------------------------------------------------------------

// A region being drawn shows before it replaces the current one on release.
function shownLoopRegion(state: { loopRegion: LoopRegion | null; loopRegionDrag: LoopRegionDrag | null }): Bounds | null {
  return state.loopRegionDrag?.draft ?? state.loopRegion;
}

// -- Exports -------------------------------------------------------------------

export { shownLoopRegion };
