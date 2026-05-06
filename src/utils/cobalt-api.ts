// -- Types --------------------------------------------------------------------

interface SessionResponse {
  jwt: string;
  expiresAt: number;
}

interface AudioResponse {
  tunnelUrl: string;
  expiresAt: number;
  durationSec?: number;
}

interface ServerError {
  error?: string;
  code?: string;
  reason?: string;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[CobaltAPI]";

const ERROR_MESSAGES: Record<string, string> = {
  turnstile_failed: "Verification failed, refresh and try again",
  turnstile_missing: "Verification token is missing",
  invalid_origin: "This site is not allowed to make this request",
  invalid_video_id: "That doesn't look like a valid YouTube video",
  rate_limited: "Too many requests, wait a minute and try again",
  ip_mismatch: "Your network changed, refresh to continue",
  jwt_expired: "Session expired, refresh and try again",
  jwt_invalid: "Session is invalid, refresh and try again",
  cobalt_failed: "Couldn't fetch audio, try again later",
  geo_blocked: "This video isn't available in this region",
  video_unavailable: "Video unavailable, removed, or private",
  bot_detection: "YouTube is rate-limiting, try again later",
  network_error: "Network error, check your connection",
  unknown: "Something went wrong, try again",
};

// -- Errors -------------------------------------------------------------------

class CobaltApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(mapError(code));
    this.name = "CobaltApiError";
    this.code = code;
    this.status = status;
  }
}

// -- Functions ----------------------------------------------------------------

function mapError(code: string): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown;
}

function baseUrl(): string {
  const url = import.meta.env.VITE_COBALT_API_URL;
  if (!url) {
    throw new Error(`${LOG_PREFIX} VITE_COBALT_API_URL is not configured`);
  }
  return url.replace(/\/$/, "");
}

async function parseError(res: Response): Promise<CobaltApiError> {
  let body: ServerError;
  try {
    body = (await res.json()) as ServerError;
  } catch {
    body = { error: "unknown" };
  }
  const code = body.error ?? body.code ?? "unknown";
  return new CobaltApiError(code, res.status);
}

async function getSession(turnstileToken: string): Promise<SessionResponse> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ turnstileToken }),
    });
  } catch (err) {
    console.error(LOG_PREFIX, "session fetch failed", err);
    throw new CobaltApiError("network_error", 0);
  }
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as SessionResponse;
}

async function getAudio(videoId: string, jwt: string): Promise<AudioResponse> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/api/audio?youtube=${encodeURIComponent(videoId)}`, {
      headers: { authorization: `Bearer ${jwt}` },
    });
  } catch (err) {
    console.error(LOG_PREFIX, "audio fetch failed", err);
    throw new CobaltApiError("network_error", 0);
  }
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AudioResponse;
}

// -- Exports ------------------------------------------------------------------

export { CobaltApiError, getAudio, getSession, mapError };
export type { AudioResponse, SessionResponse };
