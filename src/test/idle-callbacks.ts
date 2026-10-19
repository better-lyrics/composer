// -- State --------------------------------------------------------------------

const IDLE_DEADLINE: IdleDeadline = { didTimeout: false, timeRemaining: () => 50 };

let holding = false;
const heldCallbacks = new Map<number, IdleRequestCallback>();
const pendingTimers = new Map<number, number>();
let nextHandle = 1;

// -- Shim ---------------------------------------------------------------------

function requestIdleCallbackShim(callback: IdleRequestCallback): number {
  const handle = nextHandle++;
  if (holding) {
    heldCallbacks.set(handle, callback);
    return handle;
  }
  const timer = window.setTimeout(() => {
    pendingTimers.delete(handle);
    callback(IDLE_DEADLINE);
  }, 0);
  pendingTimers.set(handle, timer);
  return handle;
}

function cancelIdleCallbackShim(handle: number): void {
  heldCallbacks.delete(handle);
  const timer = pendingTimers.get(handle);
  if (timer === undefined) return;
  window.clearTimeout(timer);
  pendingTimers.delete(handle);
}

// -- Functions ----------------------------------------------------------------

// Real idle time depends on how busy the machine is, so tests run idle callbacks on the next task instead.
function installPromptIdleCallbacks(): void {
  holding = false;
  heldCallbacks.clear();
  window.requestIdleCallback = requestIdleCallbackShim;
  window.cancelIdleCallback = cancelIdleCallbackShim;
}

function holdIdleCallbacks(): void {
  holding = true;
}

function releaseIdleCallbacks(): void {
  holding = false;
  const released = [...heldCallbacks.values()];
  heldCallbacks.clear();
  for (const callback of released) callback(IDLE_DEADLINE);
}

// -- Exports ------------------------------------------------------------------

export { holdIdleCallbacks, installPromptIdleCallbacks, releaseIdleCallbacks };
