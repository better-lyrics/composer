import { useProjectStore } from "@/stores/project";
import type { createRowLayoutCache } from "@/views/timeline/row-layout-cache";
import { WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";
import type { FollowInput } from "@/views/timeline/vertical-follow";

// -- Types --------------------------------------------------------------------

type RowLayoutFor = ReturnType<typeof createRowLayoutCache>;

// -- Functions ----------------------------------------------------------------

function createFollowInput(): FollowInput {
  return {
    lines: [],
    time: 0,
    selection: null,
    layout: { lineTops: new Map(), headerTops: new Map() },
    collapsedInstances: {},
    viewportHeight: 0,
    coveredTop: WAVEFORM_HEIGHT,
  };
}

// Mutates the input so the per-frame follow loop does not allocate.
function fillFollowInput(
  input: FollowInput,
  rowLayoutFor: RowLayoutFor,
  time: number,
  viewportHeight: number,
): FollowInput {
  const lines = useProjectStore.getState().lines;
  const timeline = useTimelineStore.getState();
  input.lines = lines;
  input.time = time;
  const followsSelection = timeline.selectionPlayback !== null && timeline.selectedWords.length > 0;
  input.selection = followsSelection ? timeline.selectedWords : null;
  input.layout = rowLayoutFor(lines, timeline);
  input.collapsedInstances = timeline.collapsedInstances;
  input.viewportHeight = viewportHeight;
  return input;
}

// -- Exports ------------------------------------------------------------------

export { createFollowInput, fillFollowInput };
