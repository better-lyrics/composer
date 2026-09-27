import { type ProjectSaveInput, saveCurrentProject } from "@/lib/persistence";
import { useSettingsStore } from "@/stores/settings";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Persistence]";

// -- Module state -------------------------------------------------------------

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSave: ProjectSaveInput | null = null;

// -- Public API ---------------------------------------------------------------

function debouncedSave(input: ProjectSaveInput): void {
  pendingSave = input;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  const saveDelay = useSettingsStore.getState().autoSaveDelay;
  saveTimeout = setTimeout(() => {
    if (pendingSave) {
      saveCurrentProject(pendingSave).catch((err) => console.error(LOG_PREFIX, "Auto-save failed:", err));
      pendingSave = null;
    }
    saveTimeout = null;
  }, saveDelay);
}

function cancelPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingSave = null;
}

function flushPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (pendingSave) {
    saveCurrentProject(pendingSave).catch((err) => console.error(LOG_PREFIX, "Flush save failed:", err));
    pendingSave = null;
  }
}

// -- Exports ------------------------------------------------------------------

export { debouncedSave, cancelPendingSave, flushPendingSave };
