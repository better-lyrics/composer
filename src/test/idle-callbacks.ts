// -- State --------------------------------------------------------------------

const IDLE_DEADLINE: IdleDeadline = { didTimeout: false, timeRemaining: () => 50 };

const pendingTimers = new Map<number, number>();
let nextHandle = 1;

// -- Shim ---------------------------------------------------------------------

function requestIdleCallbackShim(callback: IdleRequestCallback): number {
  const handle = nextHandle++;
  const timer = window.setTimeout(() => {
    pendingTimers.delete(handle);
    callback(IDLE_DEADLINE);
  }, 0);
  pendingTimers.set(handle, timer);
  return handle;
}

function cancelIdleCallbackShim(handle: number): void {
  const timer = pendingTimers.get(handle);
  if (timer === undefined) return;
  window.clearTimeout(timer);
  pendingTimers.delete(handle);
}

// -- Functions ----------------------------------------------------------------

// Real idle time depends on how busy the machine is, so tests run idle callbacks on the next task instead.
function installPromptIdleCallbacks(): void {
  window.requestIdleCallback = requestIdleCallbackShim;
  window.cancelIdleCallback = cancelIdleCallbackShim;
}

// -- Exports -------------------------------------------------------------------

export { installPromptIdleCallbacks };
