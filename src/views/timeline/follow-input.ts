import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { FOLLOW_LEAD_SECONDS } from "@/views/timeline/follow-ease";
import { currentOverviewBandHeight } from "@/views/timeline/overview-band-height";
import type { createRowLayoutCache } from "@/views/timeline/row-layout-cache";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { FollowInput } from "@/views/timeline/vertical-follow";

// -- Types --------------------------------------------------------------------

type RowLayoutFor = ReturnType<typeof createRowLayoutCache>;

// -- Functions ----------------------------------------------------------------

function createFollowInput(): FollowInput {
  return {
    lines: [],
    time: 0,
    lead: 0,
    selection: null,
    layout: { lineTops: new Map(), headerTops: new Map() },
    collapsedInstances: {},
    viewportHeight: 0,
    coveredTop: currentOverviewBandHeight(),
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
  input.lead = FOLLOW_LEAD_SECONDS * useAudioStore.getState().playbackRate;
  const followsSelection = timeline.selectionPlayback !== null && timeline.selectedWords.length > 0;
  input.selection = followsSelection ? timeline.selectedWords : null;
  input.layout = rowLayoutFor(lines, timeline);
  input.collapsedInstances = timeline.collapsedInstances;
  input.viewportHeight = viewportHeight;
  input.coveredTop = currentOverviewBandHeight();
  return input;
}

// -- Exports ------------------------------------------------------------------

export { createFollowInput, fillFollowInput };
