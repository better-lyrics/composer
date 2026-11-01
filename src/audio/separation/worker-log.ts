const LOG_PREFIX = "[separation-worker]";

function log(...args: unknown[]) {
  console.info(LOG_PREFIX, ...args);
}

// ORT's WebGPU backend can reject with a non-Error, which would show as "undefined".
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return `Non-Error thrown: ${typeof err} ${String(err)}`;
}

export { describeError, log };
