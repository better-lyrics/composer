// -- Types --------------------------------------------------------------------

type SharedTimingCopiedListener = (groupIds: readonly string[]) => void;

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[SharedTimingSignals]";

// -- Module state -------------------------------------------------------------

const listeners = new Set<SharedTimingCopiedListener>();

// -- Signals ------------------------------------------------------------------

// Emitted from inside a store update, so listeners must only schedule UI work.
function notifySharedTimingCopied(groupIds: readonly string[]): void {
  for (const listener of listeners) {
    try {
      listener(groupIds);
    } catch (error) {
      console.error(LOG_PREFIX, "a shared timing listener failed", error);
    }
  }
}

function subscribeSharedTimingCopied(listener: SharedTimingCopiedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// -- Exports ------------------------------------------------------------------

export { notifySharedTimingCopied, subscribeSharedTimingCopied };
