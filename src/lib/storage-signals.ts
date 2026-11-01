// -- Types --------------------------------------------------------------------

type StorageSignal = "media-stored" | "media-removed" | "storage-full";
type StorageSignalListener = (signal: StorageSignal) => void;

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[StorageSignals]";
const QUOTA_EXCEEDED = "QuotaExceededError";

// -- Module state -------------------------------------------------------------

const listeners = new Set<StorageSignalListener>();

// -- Signals ------------------------------------------------------------------

function notifyStorageSignal(signal: StorageSignal): void {
  for (const listener of listeners) {
    try {
      listener(signal);
    } catch (error) {
      console.error(LOG_PREFIX, "a storage signal listener failed", error);
    }
  }
}

function subscribeStorageSignals(listener: StorageSignalListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// -- Quota errors -------------------------------------------------------------

function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && error.name === QUOTA_EXCEEDED;
}

function reportStorageWriteError(error: unknown): void {
  if (isQuotaExceededError(error)) notifyStorageSignal("storage-full");
}

// -- Exports ------------------------------------------------------------------

export { notifyStorageSignal, subscribeStorageSignals, isQuotaExceededError, reportStorageWriteError };
export type { StorageSignal };
