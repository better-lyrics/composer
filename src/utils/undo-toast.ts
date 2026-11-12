import { useProjectStore } from "@/stores/project";
import { toast } from "@/utils/toast";

// -- Functions -----------------------------------------------------------------

function showUndoToast(message: string, undo: () => void = () => useProjectStore.getState().undo()): void {
  toast.success(message, { action: { label: "Undo", onClick: undo } });
}

// -- Exports -------------------------------------------------------------------

export { showUndoToast };
