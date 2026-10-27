import { applySavedProject } from "@/lib/apply-saved-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { buildSavedProject } from "@/lib/persistence";
import { migratePrimingTimings } from "@/lib/priming-migration";
import { currentSaveInput } from "@/lib/project-snapshot";
import { useProjectStore } from "@/stores/project";

// -- Public API ---------------------------------------------------------------

// A relinked project gets the migration a stored project gets on load, before its audio starts playing.
async function migrateRelinkedProjectTimings(projectId: string, audio: File): Promise<void> {
  const project = buildSavedProject(currentSaveInput());
  if (!(await migratePrimingTimings(projectId, project, audio))) return;
  if (openProjectIdSnapshot() !== projectId) return;
  applySavedProject(project, "storage");
  useProjectStore.getState().clearHistory();
}

// -- Exports ------------------------------------------------------------------

export { migrateRelinkedProjectTimings };
