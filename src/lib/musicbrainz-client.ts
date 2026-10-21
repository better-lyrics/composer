// -- Constants ----------------------------------------------------------------

const MIN_REQUEST_GAP_MS = 1000;
const RETRY_AFTER_MS = 1500;
const RATE_LIMITED_STATUS = 503;
const REQUEST_TIMEOUT_MS = 15_000;
const LOG_PREFIX = "[MusicBrainz]";

// -- Errors -------------------------------------------------------------------

class MusicBrainzHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`MusicBrainz request failed: ${status}`);
    this.name = "MusicBrainzHttpError";
    this.status = status;
  }
}

// -- Queue --------------------------------------------------------------------

let queueTail: Promise<unknown> = Promise.resolve();
let lastRequestAt = Number.NEGATIVE_INFINITY;

function resetMusicBrainzQueue(): void {
  queueTail = Promise.resolve();
  lastRequestAt = Number.NEGATIVE_INFINITY;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queueTail.then(task);
  queueTail = run.catch(() => undefined);
  return run;
}

// -- Fetch --------------------------------------------------------------------

async function fetchInTurn(url: string, signal?: AbortSignal): Promise<Response> {
  await wait(Math.max(0, lastRequestAt + MIN_REQUEST_GAP_MS - Date.now()), signal);
  lastRequestAt = Date.now();
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
}

function fetchMusicBrainz<T>(url: string, signal?: AbortSignal): Promise<T> {
  return enqueue(async () => {
    let response = await fetchInTurn(url, signal);
    if (response.status === RATE_LIMITED_STATUS) {
      console.warn(LOG_PREFIX, "rate limited, retrying once", url);
      await wait(RETRY_AFTER_MS, signal);
      response = await fetchInTurn(url, signal);
    }
    if (!response.ok) throw new MusicBrainzHttpError(response.status);
    return (await response.json()) as T;
  });
}

// -- Exports ------------------------------------------------------------------

export { MusicBrainzHttpError, fetchMusicBrainz, resetMusicBrainzQueue };
