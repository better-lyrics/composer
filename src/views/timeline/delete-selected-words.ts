import { deleteWords } from "@/domain/commands/word-structure";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Actions ------------------------------------------------------------------

function deleteSelectedWords() {
  const { selectedWords } = useTimelineStore.getState();
  if (selectedWords.length === 0) return;

  const before = useProjectStore.getState().lines;
  useProjectStore.getState().commit(deleteWords(selectedWords));
  if (useProjectStore.getState().lines !== before) useTimelineStore.getState().clearSelection();
}

// -- Exports ------------------------------------------------------------------

export { deleteSelectedWords };
