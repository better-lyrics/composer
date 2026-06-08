// HTTP client for the optional companion `composer-bridge` Go binary that
// users run locally to extract YouTube audio through their residential IP.
// See `experiments/composer-bridge/README.md` for what the binary is.

const DEFAULT_BRIDGE_URL = "http://localhost:7777";
const HEALTH_TIMEOUT_MS = 1500;
const AUDIO_TIMEOUT_MS = 5 * 60 * 1000;

interface BridgeHealth {
  bridge: string;
  ytdlp: string;
  status: string;
}

interface BridgeAudio {
  buffer: ArrayBuffer;
  mimeType: string;
}

class BridgeError extends Error {
  readonly code: "unreachable" | "http" | "empty" | "timeout";
  readonly status?: number;

  constructor(code: BridgeError["code"], message: string, status?: number) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
    this.status = status;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function checkBridgeHealth(baseUrl: string, signal?: AbortSignal): Promise<BridgeHealth> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const composed = signal ? (AbortSignal.any?.([signal, controller.signal]) ?? controller.signal) : controller.signal;
  try {
    const res = await fetch(`${normalizeBaseUrl(baseUrl)}/health`, { signal: composed });
    if (!res.ok) throw new BridgeError("http", `health: ${res.status}`, res.status);
    return (await res.json()) as BridgeHealth;
  } catch (err) {
    if (err instanceof BridgeError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new BridgeError("timeout", "bridge health timed out");
    }
    throw new BridgeError("unreachable", err instanceof Error ? err.message : "unreachable");
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getAudioFromBridge(baseUrl: string, videoId: string, signal?: AbortSignal): Promise<BridgeAudio> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUDIO_TIMEOUT_MS);
  const composed = signal ? (AbortSignal.any?.([signal, controller.signal]) ?? controller.signal) : controller.signal;
  try {
    const res = await fetch(`${normalizeBaseUrl(baseUrl)}/audio/${encodeURIComponent(videoId)}`, {
      signal: composed,
    });
    if (!res.ok) throw new BridgeError("http", `bridge audio: ${res.status}`, res.status);
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) throw new BridgeError("empty", "bridge returned empty audio");
    return { buffer, mimeType: res.headers.get("content-type") ?? "audio/mp4" };
  } catch (err) {
    if (err instanceof BridgeError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new BridgeError("timeout", "bridge audio timed out");
    }
    throw new BridgeError("unreachable", err instanceof Error ? err.message : "unreachable");
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatBridgeErrorForToast(err: unknown): string {
  if (err instanceof BridgeError) {
    switch (err.code) {
      case "unreachable":
        return "Composer Bridge is not running. Start the bridge or disable the YouTube Bridge setting.";
      case "timeout":
        return "Composer Bridge timed out. Check that the bridge process is healthy.";
      case "empty":
        return "Bridge returned no audio. Try a different video.";
      case "http":
        return `Bridge error (HTTP ${err.status ?? "unknown"}). Check the bridge console for details.`;
    }
  }
  return "Composer Bridge failed for an unknown reason.";
}

export { DEFAULT_BRIDGE_URL, BridgeError, checkBridgeHealth, getAudioFromBridge, formatBridgeErrorForToast };
export type { BridgeHealth, BridgeAudio };
