// -- Types ---------------------------------------------------------------------

interface ExtensionPort {
  onMessage: { addListener: (listener: (message: unknown) => void) => void };
  onDisconnect: { addListener: (listener: () => void) => void };
  postMessage: (message: unknown) => void;
  disconnect: () => void;
}

interface ExtensionRuntime {
  connect: (extensionId: string, info: { name: string }) => ExtensionPort;
  lastError?: { message?: string };
}

type ExtensionAuthResponse = { ok: true; signedBody: unknown } | { ok: false; reason?: string };

// -- Constants -----------------------------------------------------------------

const BETTER_LYRICS_EXTENSION_ID = "effdbpeggelllpfkjppbokhmmiinhlmg";
const AUTH_PORT_NAME = "bl-auth-site";
const PROBE_PORT_NAME = "bl-probe";
const PROBE_TIMEOUT_MS = 200;
const LOG_PREFIX = "[UnisonExtension]";

// -- Errors --------------------------------------------------------------------

class ExtensionAuthError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Better Lyrics sign-in failed (${reason})`);
    this.reason = reason;
  }
}

// -- Helpers -------------------------------------------------------------------

function extensionRuntime(): ExtensionRuntime | null {
  const runtime = (globalThis as { chrome?: { runtime?: Partial<ExtensionRuntime> } }).chrome?.runtime;
  return typeof runtime?.connect === "function" ? (runtime as ExtensionRuntime) : null;
}

function disconnectQuietly(port: ExtensionPort): void {
  try {
    port.disconnect();
  } catch (error) {
    console.debug(`${LOG_PREFIX} Port was already closed`, error);
  }
}

function probe(runtime: ExtensionRuntime, extensionId: string): Promise<boolean> {
  return new Promise((resolve) => {
    let port: ExtensionPort;
    try {
      port = runtime.connect(extensionId, { name: PROBE_PORT_NAME });
    } catch {
      resolve(false);
      return;
    }
    let settled = false;
    const settle = (found: boolean) => {
      if (settled) return;
      settled = true;
      disconnectQuietly(port);
      resolve(found);
    };
    // A missing extension disconnects at once with lastError; an installed one keeps the port open.
    const timer = setTimeout(() => settle(true), PROBE_TIMEOUT_MS);
    port.onDisconnect.addListener(() => {
      clearTimeout(timer);
      settle(!runtime.lastError);
    });
  });
}

// -- Functions -----------------------------------------------------------------

async function findBetterLyricsExtension(): Promise<string | null> {
  const runtime = extensionRuntime();
  if (!runtime) return null;
  return (await probe(runtime, BETTER_LYRICS_EXTENSION_ID)) ? BETTER_LYRICS_EXTENSION_ID : null;
}

function requestSignedSession(extensionId: string, nonce: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const runtime = extensionRuntime();
    if (!runtime) {
      reject(new ExtensionAuthError("NOT_AVAILABLE"));
      return;
    }
    let port: ExtensionPort;
    try {
      port = runtime.connect(extensionId, { name: AUTH_PORT_NAME });
    } catch {
      reject(new ExtensionAuthError("NOT_ALLOWED"));
      return;
    }
    let settled = false;
    port.onMessage.addListener((raw) => {
      if (settled) return;
      settled = true;
      const response = raw as ExtensionAuthResponse | null;
      if (response?.ok) resolve(response.signedBody);
      else reject(new ExtensionAuthError(response?.reason ?? "SIGN_FAILED"));
      disconnectQuietly(port);
    });
    port.onDisconnect.addListener(() => {
      if (settled) return;
      settled = true;
      reject(new ExtensionAuthError(runtime.lastError?.message ? "NOT_ALLOWED" : "USER_DISMISSED"));
    });
    port.postMessage({ type: "bl-auth-request", nonce, origin: window.location.origin });
  });
}

// -- Exports -------------------------------------------------------------------

export type { ExtensionPort };
export { BETTER_LYRICS_EXTENSION_ID, ExtensionAuthError, findBetterLyricsExtension, requestSignedSession };
