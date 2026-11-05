import type { SeparationError, SeparationStatus } from "@/audio/separation/types";
import type { VocalSeparator } from "@/audio/separation/vocal-separator";

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
  separator: VocalSeparator,
  isCancelling: () => boolean,
): Promise<boolean> {
  set({ status: "downloading", error: null, progress: { loaded: 0, total: 0 } });
  try {
    await separator.init((loaded, total) => set({ progress: { loaded, total } }));
    return true;
  } catch (err) {
    if ((err as Error).name === "AbortError" || isCancelling()) {
      set({ status: "idle" });
    } else {
      const code = (err as { code?: unknown }).code === "integrity-mismatch" ? "integrity-mismatch" : "fetch-failed";
      set({ status: "error", error: { code, message: (err as Error).message } });
    }
    return false;
  }
}

// -- Exports ------------------------------------------------------------------

export { runModelDownload };
