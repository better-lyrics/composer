// -- Helpers --------------------------------------------------------------------

function overrideVisibilityState(value: DocumentVisibilityState): () => void {
  const original = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
  return () => {
    if (original) Object.defineProperty(document, "visibilityState", original);
  };
}

// -- Exports ----------------------------------------------------------------

export { overrideVisibilityState };
