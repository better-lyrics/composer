import { getActiveCobaltInstance } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

interface SessionResponse {
  jwt: string;
  expiresAt: number;
}

interface AudioResponse {
  tunnelUrl: string;
  expiresAt?: number;
  filename?: string;
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
  too_long: "This video is too long for the selected cobalt instance",
  picker_unsupported: "This URL returned multiple items, which Composer can't import",
  bad_response: "The cobalt instance returned an unexpected response",
  empty_audio: "The cobalt instance returned an empty file, try a different instance",
  auth_required: "This cobalt instance requires authentication that Composer doesn't support",
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
  const url = getActiveCobaltInstance().url || import.meta.env.VITE_COBALT_API_URL;
  if (!url) {
    throw new Error(`${LOG_PREFIX} no Cobalt instance configured`);
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
  const code = body.reason ? mapStandardCobaltErrorCode(body.reason) : (body.error ?? body.code ?? "unknown");
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

// -- Standard cobalt --------------------------------------------------------

function stripFilenameExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) return filename;
  const ext = filename.slice(lastDot + 1);
  if (!/^[a-z0-9]{1,5}$/i.test(ext)) return filename;
  return filename.slice(0, lastDot);
}

function mapStandardCobaltErrorCode(code: string): string {
  if (code.includes("auth")) return "auth_required";
  if (code.includes("rate")) return "rate_limited";
  if (code.includes("region") || code.includes("geo")) return "geo_blocked";
  if (code.includes("too_long")) return "too_long";
  if (code.includes("unavailable") || code.includes("private") || code.includes("empty")) return "video_unavailable";
  if (code.includes("link.invalid") || code.includes("link.unsupported")) return "invalid_video_id";
  if (code.includes("bot") || code.includes("captcha") || code.includes("login")) return "bot_detection";
  return "cobalt_failed";
}

function parseStandardCobaltResponse(body: unknown): AudioResponse {
  if (body === null || typeof body !== "object") {
    throw new CobaltApiError("bad_response", 0);
  }
  const payload = body as {
    status?: string;
    url?: string;
    filename?: string;
    error?: { code?: string };
  };

  if (payload.status === "error") {
    const code = payload.error?.code ?? "unknown";
    throw new CobaltApiError(mapStandardCobaltErrorCode(code), 0);
  }

  if (payload.status === "picker") {
    throw new CobaltApiError("picker_unsupported", 0);
  }

  if (payload.status !== "tunnel" && payload.status !== "redirect") {
    throw new CobaltApiError("bad_response", 0);
  }

  if (typeof payload.url !== "string" || payload.url.length === 0) {
    throw new CobaltApiError("bad_response", 0);
  }

  return {
    tunnelUrl: payload.url,
    filename: typeof payload.filename === "string" ? stripFilenameExtension(payload.filename) : undefined,
  };
}

function buildYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

async function getAudioFromStandardCobalt(videoId: string): Promise<AudioResponse> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        url: buildYouTubeUrl(videoId),
        downloadMode: "audio",
        audioFormat: "best",
        filenameStyle: "basic",
      }),
    });
  } catch (err) {
    console.error(LOG_PREFIX, "standard cobalt fetch failed", err);
    throw new CobaltApiError("network_error", 0);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new CobaltApiError("bad_response", res.status);
  }
  return parseStandardCobaltResponse(body);
}

// -- Exports ------------------------------------------------------------------

export {
  CobaltApiError,
  getAudio,
  getAudioFromStandardCobalt,
  getSession,
  mapError,
  parseStandardCobaltResponse,
  stripFilenameExtension,
};
