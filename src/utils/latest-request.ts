// -- Types --------------------------------------------------------------------

interface RequestTicket {
  signal: AbortSignal;
  isCurrent: () => boolean;
  finish: () => void;
}

interface LatestRequest {
  start: () => RequestTicket;
  cancel: () => void;
  isRunning: () => boolean;
}

// -- Functions ----------------------------------------------------------------

// Starting a request aborts the one before it, so only the newest result is ever applied.
function createLatestRequest(): LatestRequest {
  let running: AbortController | null = null;
  return {
    start() {
      running?.abort();
      const controller = new AbortController();
      running = controller;
      return {
        signal: controller.signal,
        isCurrent: () => running === controller && !controller.signal.aborted,
        finish: () => {
          if (running === controller) running = null;
        },
      };
    },
    cancel() {
      running?.abort();
      running = null;
    },
    isRunning: () => running !== null,
  };
}

// -- Exports ------------------------------------------------------------------

export { createLatestRequest };
export type { LatestRequest, RequestTicket };
