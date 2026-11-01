import { getSeparationWorker } from "@/audio/separation/shared-separation-worker";
import type { SeparationError, SeparationStatus } from "@/audio/separation/types";
import type { VocalModelVariant } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

interface ModelDownloadState {
  status: SeparationStatus;
  error: SeparationError | null;
  progress: { loaded: number; total: number };
}

type SetModelDownloadState = (partial: Partial<ModelDownloadState>) => void;

// -- Download -----------------------------------------------------------------

// Download-init prologue for `separate`. Returns true if the model initialised, false if it aborted or
// errored; on abort or error the caller's status has already been written to "idle" or "error".
async function runModelDownload(
  set: SetModelDownloadState,
  variant: VocalModelVariant,
  isCancelling: () => boolean,
): Promise<boolean> {
  set({ status: "downloading", error: null, progress: { loaded: 0, total: 0 } });
  try {
    await getSeparationWorker().init({
      variant,
      onProgress: (loaded, total) => set({ progress: { loaded, total } }),
    });
    return true;
  } catch (err) {
    if ((err as Error).name === "AbortError" || isCancelling()) {
      set({ status: "idle" });
    } else {
      set({ status: "error", error: { code: "fetch-failed", message: (err as Error).message } });
    }
    return false;
  }
}

// -- Exports ------------------------------------------------------------------

export { runModelDownload };
