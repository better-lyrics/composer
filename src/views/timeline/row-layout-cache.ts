import { type RowLayout, type RowLayoutInput, computeRowLayout } from "@/views/timeline/utils";

// -- Helpers ------------------------------------------------------------------

function sameLayoutInput(a: RowLayoutInput, b: RowLayoutInput): boolean {
  return (
    a.lines === b.lines &&
    a.rowHeights === b.rowHeights &&
    a.defaultRowHeight === b.defaultRowHeight &&
    a.collapsedInstances === b.collapsedInstances &&
    a.focusedGroup === b.focusedGroup &&
    a.waveformHeight === b.waveformHeight &&
    a.groupHeaderHeight === b.groupHeaderHeight
  );
}

// -- Functions ----------------------------------------------------------------

// Per-frame readers get the same layout object until an input changes.
function createRowLayoutCache(): (input: RowLayoutInput) => RowLayout {
  let cached: { input: RowLayoutInput; layout: RowLayout } | null = null;
  return (input) => {
    if (cached && sameLayoutInput(cached.input, input)) return cached.layout;
    cached = { input, layout: computeRowLayout(input) };
    return cached.layout;
  };
}

// -- Exports ------------------------------------------------------------------

export { createRowLayoutCache };
