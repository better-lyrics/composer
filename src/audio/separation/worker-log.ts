// Path-selection and timing logging for the separation worker: which backend
// runs the model, why, and how a run went.
function log(...args: unknown[]) {
  console.info("[separation-worker]", ...args);
}

// ORT's WebGPU backend sometimes rejects with a non-Error (e.g. a number), which
// would otherwise surface as "undefined" in the UI.
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return `Non-Error thrown: ${typeof err} ${String(err)}`;
}

export { describeError, log };
