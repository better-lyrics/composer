// -- Types --------------------------------------------------------------------

type SharedTimingCopiedListener = (groupIds: readonly string[]) => void;

type PlacementBlockedListener = () => void;

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[SharedTimingSignals]";

// -- Module state -------------------------------------------------------------

const listeners = new Set<SharedTimingCopiedListener>();
const blockedListeners = new Set<PlacementBlockedListener>();

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

// A command refused because an instance, or a shared copy of it, has no room where it would land.
function notifyPlacementBlocked(): void {
  for (const listener of blockedListeners) listener();
}

function subscribePlacementBlocked(listener: PlacementBlockedListener): () => void {
  blockedListeners.add(listener);
  return () => {
    blockedListeners.delete(listener);
  };
}

// -- Exports ------------------------------------------------------------------

export { notifyPlacementBlocked, notifySharedTimingCopied, subscribePlacementBlocked, subscribeSharedTimingCopied };
