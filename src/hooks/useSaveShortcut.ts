import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { saveNow } from "@/lib/persistence-debounce";
import { isRestoringProject } from "@/lib/project-restore";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { useEffect } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[SaveShortcut]";
const SAVE_SHORTCUT_ID = "global.saveNow";

// -- Hook ---------------------------------------------------------------------

function useSaveShortcut(canSave: boolean): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (findMatchingShortcut(event, "global") !== SAVE_SHORTCUT_ID) return;
      event.preventDefault();
      // Held keys still match so the browser's own save dialog never opens, but only the first press saves.
      if (event.repeat || !canSave || openProjectIdSnapshot() === undefined || isRestoringProject()) return;
      saveNow().catch((error: unknown) => console.error(LOG_PREFIX, "could not save the project", error));
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [canSave]);
}

// -- Exports ------------------------------------------------------------------

export { useSaveShortcut };
