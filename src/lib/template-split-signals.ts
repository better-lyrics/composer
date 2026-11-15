// -- Types --------------------------------------------------------------------

// How many instances a split in one of them now reaches, for each group it reached.
type TemplateSplitListener = (instanceCounts: readonly number[]) => void;

// -- Module state -------------------------------------------------------------

const splitListeners = new Set<TemplateSplitListener>();

// -- Signals ------------------------------------------------------------------

// Emitted from inside a store update, so listeners only schedule UI work.
function notifyTemplateSplit(instanceCounts: readonly number[]): void {
  for (const listener of splitListeners) listener(instanceCounts);
}

function subscribeTemplateSplit(listener: TemplateSplitListener): () => void {
  splitListeners.add(listener);
  return () => splitListeners.delete(listener);
}

// -- Exports ------------------------------------------------------------------

export { notifyTemplateSplit, subscribeTemplateSplit };
