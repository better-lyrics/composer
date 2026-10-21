// -- Signals ------------------------------------------------------------------

// Falls back to a listener pair where AbortSignal.any is missing.
function composeAbortSignals(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (!a) return b;
  const composed = AbortSignal.any?.([a, b]);
  if (composed) return composed;
  const local = new AbortController();
  const abortLocal = () => local.abort();
  if (a.aborted) local.abort();
  else a.addEventListener("abort", abortLocal, { once: true });
  if (b.aborted) local.abort();
  else b.addEventListener("abort", abortLocal, { once: true });
  return local.signal;
}

// -- Exports ------------------------------------------------------------------

export { composeAbortSignals };
