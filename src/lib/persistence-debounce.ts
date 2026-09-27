import { saveCurrentProject } from "@/lib/persistence";
import { useSettingsStore } from "@/stores/settings";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Persistence]";

// -- Module state -------------------------------------------------------------

type SaveArgs = Parameters<typeof saveCurrentProject>;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSaveArgs: SaveArgs | null = null;

// -- Public API ---------------------------------------------------------------

function debouncedSave(...args: SaveArgs): void {
  pendingSaveArgs = args;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  const saveDelay = useSettingsStore.getState().autoSaveDelay;
  saveTimeout = setTimeout(() => {
    if (pendingSaveArgs) {
      saveCurrentProject(...pendingSaveArgs).catch((err) => console.error(LOG_PREFIX, "Auto-save failed:", err));
      pendingSaveArgs = null;
    }
    saveTimeout = null;
  }, saveDelay);
}

function cancelPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingSaveArgs = null;
}

function flushPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (pendingSaveArgs) {
    saveCurrentProject(...pendingSaveArgs).catch((err) => console.error(LOG_PREFIX, "Flush save failed:", err));
    pendingSaveArgs = null;
  }
}

// -- Exports ------------------------------------------------------------------

export { debouncedSave, cancelPendingSave, flushPendingSave };
