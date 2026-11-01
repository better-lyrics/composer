import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions ----------------------------------------------------------------

function insertEmptyLine(anchorLineId: string, position: "above" | "below"): void {
  useProjectStore.getState().insertEmptyLineWithHistory(anchorLineId, position);
  const timeline = useTimelineStore.getState();
  if (timeline.focusedGroup !== null) timeline.closeGroup();
}

// -- Exports ------------------------------------------------------------------

export { insertEmptyLine };
