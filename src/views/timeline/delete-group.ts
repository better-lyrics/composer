import { useProjectStore } from "@/stores/project";
import { showUndoToast } from "@/utils/undo-toast";

// -- Operation -----------------------------------------------------------------

function deleteGroup(groupId: string): void {
  useProjectStore.getState().removeGroup(groupId);
  showUndoToast("Group deleted");
}

// -- Exports -------------------------------------------------------------------

export { deleteGroup };
