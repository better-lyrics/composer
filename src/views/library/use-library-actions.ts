import { openProject } from "@/lib/open-project";
import {
  type DeletableProject,
  deleteProjectsWithUndo,
  duplicateProject,
  exportProjectFiles,
  renameProject,
} from "@/lib/project-library-actions";
import { useUIStore } from "@/stores/ui";
import { EDITOR_PATH } from "@/utils/app-routes";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface LibraryActions {
  open: (id: string) => void;
  rename: (id: string, title: string) => void;
  duplicate: (id: string) => void;
  exportFiles: (ids: readonly string[]) => void;
  remove: (projects: readonly DeletableProject[]) => void;
  manageStorage: () => void;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Library]";

// -- Helpers ------------------------------------------------------------------

function reportFailure(action: string, message: string): (error: unknown) => void {
  return (error) => {
    console.error(LOG_PREFIX, action, error);
    toast.error(message);
  };
}

// -- Hook ---------------------------------------------------------------------

function useLibraryActions(): LibraryActions {
  const navigate = useNavigate();

  return useMemo(
    () => ({
      open: (id: string) => {
        openProject(id).then(
          () => navigate(EDITOR_PATH),
          reportFailure("could not open the project", "Couldn't open that project"),
        );
      },
      rename: (id: string, title: string) => {
        renameProject(id, title).catch(reportFailure("could not rename the project", "Couldn't rename that project"));
      },
      duplicate: (id: string) => {
        duplicateProject(id).catch(reportFailure("could not duplicate the project", "Couldn't duplicate that project"));
      },
      exportFiles: (ids: readonly string[]) => {
        const message = ids.length === 1 ? "Couldn't export that project" : "Couldn't export those projects";
        exportProjectFiles(ids).catch(reportFailure("could not export projects", message));
      },
      remove: deleteProjectsWithUndo,
      manageStorage: () => useUIStore.getState().openSettings({ target: { section: "storage" } }),
    }),
    [navigate],
  );
}

// -- Exports ------------------------------------------------------------------

export { useLibraryActions };
