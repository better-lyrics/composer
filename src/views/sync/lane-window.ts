// -- Interfaces ---------------------------------------------------------------

interface LaneWindow {
  start: number;
  end: number;
}

// -- Constants ----------------------------------------------------------------

// Only the anchor and its neighbours show; the rest stay mounted so a step of a few rows still fades them.
const MOUNTED_AROUND_ANCHOR = 4;

// -- Functions ----------------------------------------------------------------

function laneWindow(anchorIndex: number, rowCount: number): LaneWindow {
  return {
    start: Math.max(0, anchorIndex - MOUNTED_AROUND_ANCHOR),
    end: Math.min(rowCount, anchorIndex + MOUNTED_AROUND_ANCHOR + 1),
  };
}

// The spacer stands in for the rows above the window; a row never measured counts as the average measured row.
function heightAboveWindow(rowIds: readonly string[], heights: ReadonlyMap<string, number>, gap: number): number {
  if (rowIds.length === 0) return 0;
  let measuredTotal = 0;
  for (const height of heights.values()) measuredTotal += height;
  const estimate = heights.size > 0 ? measuredTotal / heights.size : 0;
  let total = 0;
  for (const id of rowIds) total += (heights.get(id) ?? estimate) + gap;
  return total - gap;
}

// -- Exports ------------------------------------------------------------------

export { heightAboveWindow, laneWindow };
