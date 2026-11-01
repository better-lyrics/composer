import { wholeSongRange } from "@/domain/group/shared-timing";
import type { Bounds } from "@/domain/word/bounds";

// -- Types --------------------------------------------------------------------

interface LoopRegion extends Bounds {
  loops: boolean;
}

// -- Constants ----------------------------------------------------------------

const MIN_LOOP_REGION_SECONDS = 0.05;

// -- Functions ----------------------------------------------------------------

function loopRegionBetween(anchor: number, pointer: number, duration: number): Bounds | null {
  const song = wholeSongRange(duration);
  const begin = Math.max(song.min, Math.min(anchor, pointer));
  const end = Math.min(song.max, Math.max(anchor, pointer));
  return end - begin >= MIN_LOOP_REGION_SECONDS ? { begin, end } : null;
}

function overlapsLoopRegion(span: Bounds, region: Bounds): boolean {
  return span.end > region.begin && span.begin < region.end;
}

// -- Exports ------------------------------------------------------------------

export { loopRegionBetween, MIN_LOOP_REGION_SECONDS, overlapsLoopRegion };
export type { LoopRegion };
