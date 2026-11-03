import type { UnisonPage } from "@/lib/unison/api-types";
import { clearUnisonSession, readUnisonSession } from "@/lib/unison/session";
import { isAbortError } from "@/utils/abort-error";
import { stripTrailingSlashes } from "@/utils/url";

// -- Types ---------------------------------------------------------------------

type UnisonMethod = "GET" | "POST" | "PUT" | "DELETE";

interface UnisonRequestOptions {
  method?: UnisonMethod;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  query?: Record<string, string | undefined>;
}

interface SuccessEnvelope {
  success: true;
  data?: unknown;
  nextCursor?: string | number | null;
}

interface ErrorEnvelope {
  error?: unknown;
  code?: unknown;
  hint?: unknown;
}

// -- Constants -----------------------------------------------------------------

const UNISON_BASE_URL = stripTrailingSlashes(import.meta.env.VITE_UNISON_API_URL || "https://unison.betterlyrics.org");
const LOG_PREFIX = "[Unison]";
const GENERIC_ERROR_CODE = "HTTP_ERROR";

// -- Errors --------------------------------------------------------------------

class UnisonError extends Error {
  readonly code: string;
  readonly status: number;
  readonly hint?: string;

  constructor(code: string, status: number, message?: string, hint?: string) {
    super(message ?? `Unison request failed (${code}, ${status})`);
    this.name = "UnisonError";
    this.code = code;
    this.status = status;
    this.hint = hint;
  }
}

// -- Helpers -------------------------------------------------------------------

function buildUrl(path: string, query: UnisonRequestOptions["query"]): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, value);
  }
  const search = params.toString();
  return `${UNISON_BASE_URL}${path}${search ? `?${search}` : ""}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isSuccessEnvelope(body: unknown): body is SuccessEnvelope {
  return !!body && typeof body === "object" && (body as { success?: unknown }).success === true;
}

function errorFromBody(body: unknown, status: number): UnisonError {
  const envelope: ErrorEnvelope = body && typeof body === "object" ? body : {};
  const legacyError = typeof envelope.error === "string" ? envelope.error : undefined;
  const code = typeof envelope.code === "string" ? envelope.code : (legacyError ?? GENERIC_ERROR_CODE);
  const hint = typeof envelope.hint === "string" ? envelope.hint : undefined;
  return new UnisonError(code, status, legacyError, hint);
}

// -- Functions -----------------------------------------------------------------

async function sendRequest(path: string, options: UnisonRequestOptions): Promise<SuccessEnvelope> {
  const { method = "GET", body, auth = false, signal, query } = options;
  const headers = new Headers();
  const session = auth ? readUnisonSession() : null;
  if (auth && !session) {
    // An expired session is dropped while reading it; tell subscribers so the UI shows signed out.
    clearUnisonSession();
    throw new UnisonError("AUTH_REQUIRED", 401, "Sign in to Unison first");
  }
  if (session) headers.set("authorization", `Bearer ${session.token}`);
  if (body !== undefined) headers.set("content-type", "application/json");

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.warn(`${LOG_PREFIX} Network failure on ${method} ${path}`, error);
    throw new UnisonError("NETWORK", 0, "Could not reach Unison");
  }

  const parsed = await readJson(response);
  if (response.ok && isSuccessEnvelope(parsed)) return parsed;

  const error = errorFromBody(parsed, response.status);
  if (error.code === GENERIC_ERROR_CODE) {
    console.warn(`${LOG_PREFIX} Unexpected response on ${method} ${path}`, response.status);
  }
  if (response.status === 401 && session && readUnisonSession()?.token === session.token) {
    clearUnisonSession();
  }
  throw error;
}

async function unisonFetch<T>(path: string, options: UnisonRequestOptions = {}): Promise<T> {
  const envelope = await sendRequest(path, options);
  return envelope.data as T;
}

async function unisonFetchPage<T>(path: string, options: UnisonRequestOptions = {}): Promise<UnisonPage<T>> {
  const envelope = await sendRequest(path, options);
  const items = Array.isArray(envelope.data) ? (envelope.data as T[]) : [];
  const { nextCursor } = envelope;
  return { items, nextCursor: nextCursor === undefined || nextCursor === null ? null : String(nextCursor) };
}

// -- Exports -------------------------------------------------------------------

export { UNISON_BASE_URL, UnisonError, unisonFetch, unisonFetchPage };
