import { useSettingsStore } from "@/stores/settings";

// -- Constants ----------------------------------------------------------------

const DEFAULT_BASE = "https://composer-romanization-api.boidu.dev";
const DEFAULT_RETRY_AFTER_SECONDS = 60;

// -- Types --------------------------------------------------------------------

interface RomanizeLine {
  id: string;
  text: string;
  words?: string[];
}

interface RomanizeArgs {
  scheme?: string;
  lines: RomanizeLine[];
  turnstileToken: string;
  signal?: AbortSignal;
}

interface RomanizeResult {
  id: string;
  lang: string;
  scheme: string;
  text: string;
  wordTexts?: string[];
  engine: string;
  tier: number;
}

interface RomanizeError {
  id: string;
  reason: string;
}

interface RomanizeResponse {
  results: RomanizeResult[];
  errors: RomanizeError[];
}

// -- Errors -------------------------------------------------------------------

class RomanizationApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "RomanizationApiError";
    this.code = code;
    this.status = status;
  }
}

class TurnstileError extends RomanizationApiError {
  constructor() {
    super("Turnstile verification failed", "turnstile_failed", 403);
    this.name = "TurnstileError";
  }
}

class RateLimitError extends RomanizationApiError {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super("Rate limited", "rate_limited", 429);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

class ServiceUnavailableError extends RomanizationApiError {
  constructor(message = "Service unavailable") {
    super(message, "service_unavailable", 503);
    this.name = "ServiceUnavailableError";
  }
}

// -- Functions ----------------------------------------------------------------

function readBase(): string {
  const override = useSettingsStore.getState().romanizationApiBase;
  const base = override?.trim() || DEFAULT_BASE;
  return base.replace(/\/$/, "");
}

function parseRetryAfter(response: Response, body: unknown): number {
  const detail = (body as { detail?: { retry_after?: unknown } } | null)?.detail;
  const inBody = detail && typeof detail === "object" ? detail.retry_after : undefined;
  if (typeof inBody === "number" && Number.isFinite(inBody)) return Math.max(1, Math.floor(inBody));
  const header = response.headers.get("Retry-After");
  if (header) {
    const parsed = Number.parseInt(header, 10);
    if (Number.isFinite(parsed)) return Math.max(1, parsed);
  }
  return DEFAULT_RETRY_AFTER_SECONDS;
}

async function romanizeLines(args: RomanizeArgs): Promise<RomanizeResponse> {
  const url = `${readBase()}/v1/romanize`;
  const body: Record<string, unknown> = { lines: args.lines };
  if (args.scheme) body.scheme = args.scheme;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cf-Turnstile-Token": args.turnstileToken,
      },
      body: JSON.stringify(body),
      signal: args.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ServiceUnavailableError((err as Error).message);
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (response.ok) return parsed as RomanizeResponse;
  if (response.status === 403) throw new TurnstileError();
  if (response.status === 429) throw new RateLimitError(parseRetryAfter(response, parsed));
  if (response.status === 503) throw new ServiceUnavailableError();
  throw new RomanizationApiError("Romanization request failed", "unknown", response.status);
}

// -- Exports ------------------------------------------------------------------

export { RateLimitError, RomanizationApiError, ServiceUnavailableError, TurnstileError, romanizeLines };
export type { RomanizeArgs, RomanizeError, RomanizeLine, RomanizeResponse, RomanizeResult };
