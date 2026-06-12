import { useSettingsStore } from "@/stores/settings";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Persistence]";

// -- Module state -------------------------------------------------------------

type SaveFn = () => Promise<void>;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSave: SaveFn | null = null;

// -- Public API ---------------------------------------------------------------

function debouncedSave(fn: SaveFn): void {
  pendingSave = fn;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  const saveDelay = useSettingsStore.getState().autoSaveDelay;
  saveTimeout = setTimeout(() => {
    const queued = pendingSave;
    pendingSave = null;
    saveTimeout = null;
    if (queued) {
      queued().catch((err) => console.error(LOG_PREFIX, "Auto-save failed:", err));
    }
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
  const queued = pendingSave;
  pendingSave = null;
  if (queued) {
    queued().catch((err) => console.error(LOG_PREFIX, "Flush save failed:", err));
  }
}

// -- Exports ------------------------------------------------------------------

export { debouncedSave, cancelPendingSave, flushPendingSave };
