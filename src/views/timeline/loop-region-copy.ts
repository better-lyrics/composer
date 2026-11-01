import type { Bounds } from "@/domain/word/bounds";
import { formatTime } from "@/utils/format-time";

// -- Functions -----------------------------------------------------------------

function loopRegionRangeLabel(region: Bounds): string {
  return `${formatTime(region.begin, 2)} to ${formatTime(region.end, 2)}`;
}

function loopRegionLengthLabel(region: Bounds): string {
  return `${(region.end - region.begin).toFixed(2)} s`;
}

// -- Exports -------------------------------------------------------------------

export { loopRegionLengthLabel, loopRegionRangeLabel };
