import { useProjectStore } from "@/stores/project";
import { applyWordDeletion } from "@/views/timeline/apply-word-deletion";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Actions ------------------------------------------------------------------

function deleteSelectedWords() {
  const { selectedWords } = useTimelineStore.getState();
  if (selectedWords.length === 0) return;

  const rawLines = useProjectStore.getState().lines;
  const newLines = applyWordDeletion(rawLines, selectedWords);
  if (newLines === rawLines) return;

  useProjectStore.getState().setLinesWithHistory(newLines);
  useTimelineStore.getState().clearSelection();
}

// -- Exports ------------------------------------------------------------------

export { deleteSelectedWords };
