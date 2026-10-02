import { createProject, deleteProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { buildSavedProject } from "@/lib/persistence";
import { cancelPendingSave } from "@/lib/persistence-debounce";
import { downloadProjectFile, projectFileFrom } from "@/lib/project-file";
import { importProjectFromInput } from "@/lib/project-import";
import { currentSaveInput } from "@/lib/project-snapshot";
import { useConfirm } from "@/stores/confirm-store";
import { useCallback } from "react";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ProjectFileActions]";

// -- Hook ---------------------------------------------------------------------

function useProjectFileActions() {
  const confirm = useConfirm();

  const handleExportProject = useCallback(() => {
    downloadProjectFile(projectFileFrom(openProjectIdSnapshot(), buildSavedProject(currentSaveInput())));
  }, []);

  const handleImportProject = importProjectFromInput;

  const handleClearProject = useCallback(async () => {
    const ok = await confirm({
      title: "Clear all project data?",
      description: "Remove every line, all metadata, and the audio file from this project. This cannot be undone.",
      confirmLabel: "Clear",
      variant: "destructive",
      settingsKey: "confirmClearProject",
    });
    if (!ok) return;
    const id = openProjectIdSnapshot();
    if (id) {
      await deleteProject(id).catch((error: unknown) => {
        console.error(LOG_PREFIX, "could not clear the project", error);
        toast.error("Couldn't clear the project");
      });
    } else {
      cancelPendingSave();
      createProject();
    }
  }, [confirm]);

  return { handleExportProject, handleImportProject, handleClearProject };
}

// -- Exports ------------------------------------------------------------------

export { useProjectFileActions };
