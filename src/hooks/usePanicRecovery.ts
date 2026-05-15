import { useEffect } from "react";
import { downloadRecoveryFile } from "@/lib/recovery";
import { isMac } from "@/utils/platform";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[PanicRecovery]";
const SHORTCUT_KEY = "e";

// -- Hook ---------------------------------------------------------------------

// Registers a window-level keydown listener that downloads the autosaved
// project file directly from IndexedDB. Bypasses the normal shortcut
// registry on purpose so it still fires when modals are open. Does NOT
// help when the main thread is fully frozen; for that case the user must
// open /recover in a fresh tab. Documented in the help modal.
function usePanicRecovery(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key.toLowerCase() !== SHORTCUT_KEY) return;
      const modOk = isMac ? event.metaKey : event.ctrlKey;
      if (!modOk || !event.shiftKey) return;
      event.preventDefault();
      downloadRecoveryFile().catch((err) => {
        console.error(LOG_PREFIX, "recovery download failed", err);
      });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { usePanicRecovery };
