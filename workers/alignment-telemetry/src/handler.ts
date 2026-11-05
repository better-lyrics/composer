import { checkPayload, isInstallId, type Json } from "./payload";

// Stores Composer's opt-in alignment telemetry: auto-align output next to the
// timing the user exported, used only to train future alignment models and to
// benchmark the current ones. One object per export, under the install's id,
// so a single DELETE removes everything that install ever sent.

// -- Types --------------------------------------------------------------------

/** The slice of Workers' R2Bucket this worker uses. */
interface TelemetryBucket {
  put: (key: string, value: string, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
  list: (options: { prefix: string; cursor?: string; limit?: number }) => Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
  delete: (keys: string | string[]) => Promise<void>;
}

/** Workers' rate limiting binding. */
interface RateLimiter {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

interface Env {
  TELEMETRY: TelemetryBucket;
  POST_LIMITER: RateLimiter;
  DELETE_LIMITER: RateLimiter;
}

// -- Constants ----------------------------------------------------------------

const ROUTE = "/v1/telemetry";
const MAX_BODY_BYTES = 1024 * 1024;
const LOG_PREFIX = "[alignment-telemetry]";
const ALLOWED_ORIGIN = [
  /^https:\/\/composer\.betterlyrics\.org$/,
  /^https:\/\/[a-z0-9-]+\.dev\.composer\.betterlyrics\.org$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

// -- Helpers ------------------------------------------------------------------

function isAllowedOrigin(origin: string | null): origin is string {
  return origin !== null && ALLOWED_ORIGIN.some((pattern) => pattern.test(origin));
}

function respond(status: number, origin: string | null, body?: string): Response {
  const headers = new Headers({ Vary: "Origin" });
  if (isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  if (body !== undefined) headers.set("Content-Type", "text/plain;charset=utf-8");
  return new Response(body ?? null, { status, headers });
}

// Reads at most `max` bytes, so a lying or missing Content-Length can't make the worker buffer more.
async function readCapped(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

async function store(request: Request, env: Env, origin: string): Promise<Response> {
  if (!(await env.POST_LIMITER.limit({ key: clientIp(request) })).success) return respond(429, origin);
  const text = await readCapped(request, MAX_BODY_BYTES);
  if (text === null) return respond(413, origin, "payload too large");
  let body: Json;
  try {
    body = JSON.parse(text) as Json;
  } catch {
    return respond(400, origin, "invalid JSON");
  }
  const check = checkPayload(body);
  if (!check.ok) return respond(400, origin, `invalid payload: ${check.error}`);
  const installId = (body as { installId: string }).installId;
  if (!(await env.POST_LIMITER.limit({ key: `install:${installId}` })).success) return respond(429, origin);
  const day = new Date().toISOString().slice(0, 10);
  const key = `${installId}/${day}/${crypto.randomUUID()}.json`;
  const record = { receivedAt: new Date().toISOString(), payload: body };
  await env.TELEMETRY.put(key, JSON.stringify(record), { httpMetadata: { contentType: "application/json" } });
  return respond(204, origin);
}

async function erase(request: Request, env: Env, origin: string, installId: string): Promise<Response> {
  if (!isInstallId(installId)) return respond(400, origin, "invalid install id");
  if (!(await env.DELETE_LIMITER.limit({ key: clientIp(request) })).success) return respond(429, origin);
  const prefix = `${installId}/`;
  let cursor: string | undefined;
  do {
    const page = await env.TELEMETRY.list({ prefix, cursor, limit: 1000 });
    if (page.objects.length > 0) await env.TELEMETRY.delete(page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return respond(204, origin);
}

// -- Handler ------------------------------------------------------------------

async function handle(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const { pathname } = new URL(request.url);
  const isCollection = pathname === ROUTE;
  const installId = pathname.startsWith(`${ROUTE}/`) ? pathname.slice(ROUTE.length + 1) : null;
  if (!isCollection && installId === null) return respond(404, origin);
  if (!isAllowedOrigin(origin)) return respond(403, origin);
  if (request.method === "OPTIONS") return respond(204, origin);
  try {
    if (isCollection && request.method === "POST") return await store(request, env, origin);
    if (installId !== null && request.method === "DELETE") return await erase(request, env, origin, installId);
  } catch (error) {
    console.error(LOG_PREFIX, "request failed", request.method, error);
    return respond(500, origin);
  }
  return respond(405, origin);
}

// -- Exports ------------------------------------------------------------------

export { handle, MAX_BODY_BYTES };
export type { Env, TelemetryBucket };
