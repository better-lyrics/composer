// -- Predicates ---------------------------------------------------------------

// A DOMException is not an Error instance, and some runtimes reject with a plain Error named AbortError.
function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  return error instanceof Error && error.name === "AbortError";
}

// -- Exports ------------------------------------------------------------------

export { isAbortError };
