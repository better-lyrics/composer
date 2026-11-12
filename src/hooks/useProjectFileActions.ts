import { useCallback } from "react";
import { noteGuideSignal } from "@/lib/guide-signals";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { buildSavedProject } from "@/lib/persistence";
import { downloadProjectFile, projectFileFrom } from "@/lib/project-file";
import { importProjectFromInput } from "@/lib/project-import";
import { currentSaveInput } from "@/lib/project-snapshot";

// -- Hook ---------------------------------------------------------------------

function useProjectFileActions() {
  const handleExportProject = useCallback(() => {
    downloadProjectFile(projectFileFrom(openProjectIdSnapshot(), buildSavedProject(currentSaveInput())));
    noteGuideSignal("export.backup");
  }, []);

  const handleImportProject = importProjectFromInput;

  return { handleExportProject, handleImportProject };
}

// -- Exports ------------------------------------------------------------------

export { useProjectFileActions };
