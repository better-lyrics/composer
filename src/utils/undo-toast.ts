import { useProjectStore } from "@/stores/project";
import type { HistoryEntry, ProjectState } from "@/stores/project/types";
import { toast } from "@/utils/toast";

// -- Interfaces ----------------------------------------------------------------

interface HistoryStep {
  index: number;
  undoTarget: HistoryEntry | undefined;
}

// -- Functions -----------------------------------------------------------------

function currentStep(state: ProjectState): HistoryStep {
  return { index: state.historyIndex, undoTarget: state.history[state.historyIndex - 1] };
}

function isLatestStep(state: ProjectState, step: HistoryStep): boolean {
  return (
    !state.isDirtySinceHistory && state.historyIndex === step.index && state.history[step.index - 1] === step.undoTarget
  );
}

function showUndoToast(message: string, description?: string, afterUndo?: () => void): void {
  const step = currentStep(useProjectStore.getState());
  const stopWatching = () => unsubscribe();
  const toastId = toast.success(message, {
    description,
    action: {
      label: "Undo",
      onClick: () => {
        stopWatching();
        if (!isLatestStep(useProjectStore.getState(), step)) return;
        useProjectStore.getState().undo();
        afterUndo?.();
      },
    },
    onDismiss: stopWatching,
    onAutoClose: stopWatching,
  });
  const unsubscribe = useProjectStore.subscribe((state) => {
    if (isLatestStep(state, step)) return;
    unsubscribe();
    toast.dismiss(toastId);
  });
}

// -- Exports -------------------------------------------------------------------

export { showUndoToast };
