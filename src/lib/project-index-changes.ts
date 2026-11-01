// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ProjectIndexChanges]";

// -- Module state ---------------------------------------------------------------

const listeners = new Set<() => void>();

// -- Public API ---------------------------------------------------------------

function notifyProjectIndexChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error(LOG_PREFIX, "an index change listener failed", error);
    }
  }
}

function subscribeProjectIndexChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// -- Exports ------------------------------------------------------------------

export { notifyProjectIndexChanged, subscribeProjectIndexChanges };
