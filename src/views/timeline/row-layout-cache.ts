import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { WAVEFORM_HEIGHT } from "@/views/timeline/timeline-store";
import { type RowLayout, type RowLayoutInput, computeRowLayout } from "@/views/timeline/utils";

// -- Types --------------------------------------------------------------------

type RowLayoutView = Pick<RowLayoutInput, "rowHeights" | "defaultRowHeight" | "collapsedInstances" | "focusedGroup">;

// -- Functions ----------------------------------------------------------------

// Per-frame readers get the same layout object, without allocating, until the lines or the row view change.
function createRowLayoutCache(): (lines: RowLayoutInput["lines"], view: RowLayoutView) => RowLayout {
  let cached: RowLayoutInput | null = null;
  let layout: RowLayout | null = null;
  return (lines, view) => {
    if (
      layout &&
      cached &&
      cached.lines === lines &&
      cached.rowHeights === view.rowHeights &&
      cached.defaultRowHeight === view.defaultRowHeight &&
      cached.collapsedInstances === view.collapsedInstances &&
      cached.focusedGroup === view.focusedGroup
    ) {
      return layout;
    }
    cached = {
      lines,
      rowHeights: view.rowHeights,
      defaultRowHeight: view.defaultRowHeight,
      collapsedInstances: view.collapsedInstances,
      focusedGroup: view.focusedGroup,
      waveformHeight: WAVEFORM_HEIGHT,
      groupHeaderHeight: GROUP_HEADER_HEIGHT,
    };
    layout = computeRowLayout(cached);
    return layout;
  };
}

// -- Exports ------------------------------------------------------------------

export { createRowLayoutCache };
