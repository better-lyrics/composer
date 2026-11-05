import { describe, expect, it } from "vitest";
import { type Env, handle, MAX_BODY_BYTES, type TelemetryBucket } from "./handler";

// -- Fakes --------------------------------------------------------------------

// An in-memory stand-in for the R2 binding, a Cloudflare service.
function memoryBucket(): TelemetryBucket & { objects: Map<string, string> } {
  const objects = new Map<string, string>();
  return {
    objects,
    put: async (key, value) => {
      objects.set(key, value);
    },
    list: async ({ prefix, cursor, limit = 1000 }) => {
      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = keys.slice(start, start + limit);
      const truncated = start + limit < keys.length;
      return {
        objects: page.map((key) => ({ key })),
        truncated,
        cursor: truncated ? String(start + limit) : undefined,
      };
    },
    delete: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
  };
}

function env(bucket = memoryBucket(), allow = true): Env & { bucket: ReturnType<typeof memoryBucket> } {
  const limiter = { limit: async () => ({ success: allow }) };
  return { TELEMETRY: bucket, POST_LIMITER: limiter, DELETE_LIMITER: limiter, bucket };
}

// -- Fixtures -----------------------------------------------------------------

const INSTALL_ID = "0b8f6c1e-3d2a-4c5b-9e7f-112233445566";
const OTHER_ID = "9a8b7c6d-5e4f-4a3b-8c2d-665544332211";
const ORIGIN = "https://composer.betterlyrics.org";
const URL_BASE = "https://composer-alignment-telemetry.example.workers.dev/v1/telemetry";

function payload(installId = INSTALL_ID): Record<string, unknown> {
  const word = { text: "hello", begin: 1, end: 1.4 };
  return {
    schemaVersion: 1,
    installId,
    app: { version: "2.31.0", commit: "abc1234" },
    song: { title: "Song", artists: ["Artist"], videoId: "dQw4w9WgXcQ", language: "en" },
    lyrics: { textSha256: "a".repeat(64), ttmlSha256: "b".repeat(64) },
    models: ["hubertfa-v007"],
    lines: [
      {
        lineId: "l1",
        text: "hello",
        model: { id: "hubertfa-v007", file: "hubertfa_v007_fp32_webgpu.onnx" },
        language: "en",
        taps: { begin: 0.9, end: 1.5 },
        window: { begin: 0.3, end: 1.65 },
        leadIn: "searched",
        track: "main",
        realign: false,
        fellBack: false,
        guessedWords: [],
        alignedAt: 1_700_000_000_000,
        aligned: [word],
        final: [{ ...word, begin: 1.05 }],
      },
    ],
  };
}

function post(body: string, origin: string | null = ORIGIN): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin) headers.Origin = origin;
  return new Request(URL_BASE, { method: "POST", headers, body });
}

function remove(installId: string, origin: string = ORIGIN): Request {
  return new Request(`${URL_BASE}/${installId}`, { method: "DELETE", headers: { Origin: origin } });
}

// -- Tests --------------------------------------------------------------------

describe("alignment telemetry worker", () => {
  it("stores a valid payload under its install id and date", async () => {
    const e = env();
    const response = await handle(post(JSON.stringify(payload())), e);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const [key] = [...e.bucket.objects.keys()];
    expect(key).toMatch(new RegExp(`^${INSTALL_ID}/\\d{4}-\\d{2}-\\d{2}/[0-9a-f-]{36}\\.json$`));
    expect(JSON.parse(e.bucket.objects.get(key)!).payload).toEqual(payload());
  });

  it("rejects fields outside the schema, such as audio", async () => {
    const e = env();
    const withAudio = { ...payload(), audio: "UklGRg==" };
    const lineWithSamples = payload();
    (lineWithSamples.lines as Record<string, unknown>[])[0].samples = [0.1, 0.2];
    expect((await handle(post(JSON.stringify(withAudio)), e)).status).toBe(400);
    expect((await handle(post(JSON.stringify(lineWithSamples)), e)).status).toBe(400);
    expect((await handle(post("not json"), e)).status).toBe(400);
    expect(e.bucket.objects.size).toBe(0);
  });

  it("refuses a body over the size cap", async () => {
    const e = env();
    const big = JSON.stringify({ ...payload(), padding: "x".repeat(MAX_BODY_BYTES) });
    expect((await handle(post(big), e)).status).toBe(413);
    expect(e.bucket.objects.size).toBe(0);
  });

  it("only answers Composer's origins", async () => {
    const e = env();
    const body = JSON.stringify(payload());
    expect((await handle(post(body, "https://evil.example"), e)).status).toBe(403);
    expect((await handle(post(body, null), e)).status).toBe(403);
    expect((await handle(post(body, "https://pr-12.dev.composer.betterlyrics.org"), e)).status).toBe(204);
    expect((await handle(post(body, "http://localhost:5173"), e)).status).toBe(204);
  });

  it("deletes everything one install sent and nothing else", async () => {
    const e = env();
    await handle(post(JSON.stringify(payload())), e);
    await handle(post(JSON.stringify(payload())), e);
    await handle(post(JSON.stringify(payload(OTHER_ID))), e);
    expect((await handle(remove(INSTALL_ID), e)).status).toBe(204);
    expect([...e.bucket.objects.keys()].every((key) => key.startsWith(`${OTHER_ID}/`))).toBe(true);
    expect(e.bucket.objects.size).toBe(1);
    expect((await handle(remove("not-an-install-id"), e)).status).toBe(400);
  });

  it("answers 429 when rate limited", async () => {
    const e = env(memoryBucket(), false);
    expect((await handle(post(JSON.stringify(payload())), e)).status).toBe(429);
    expect(e.bucket.objects.size).toBe(0);
  });
});
