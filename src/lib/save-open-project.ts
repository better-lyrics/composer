import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { isRestoringProject } from "@/lib/project-restore";

// -- Gate ---------------------------------------------------------------------

function canSaveOpenProject(): boolean {
  return openProjectIdSnapshot() !== undefined && !isRestoringProject();
}

// -- Exports ------------------------------------------------------------------

export { canSaveOpenProject };
