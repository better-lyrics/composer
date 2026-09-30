import { type TimeRange, timeRangeResolver } from "@/domain/group/shared-timing";
import { useProjectStore } from "@/stores/project";

// -- Functions ----------------------------------------------------------------

function storedLineTimeRange(lineId: string, duration: number): TimeRange {
  const { lines, groups } = useProjectStore.getState();
  const line = lines.find((candidate) => candidate.id === lineId);
  return line ? timeRangeResolver(lines, groups, duration)(line) : { min: 0, max: duration };
}

// -- Exports ------------------------------------------------------------------

export { storedLineTimeRange };
