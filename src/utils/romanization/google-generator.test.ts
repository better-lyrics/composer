import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { RateLimitError } from "@/utils/romanization/google/fetch";
import { createGoogleGenerator } from "@/utils/romanization/google-generator";

// -- Helpers ------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.indexedDB = new IDBFactory();
});

function googleResponse(romaji: string): Response {
  return new Response(JSON.stringify([[[null, null, null, romaji]]]), { status: 200 });
}

// -- Tests --------------------------------------------------------------------

describe("createGoogleGenerator: scheme validation", () => {
  it("throws on an unknown scheme", async () => {
    await expect(createGoogleGenerator("unknown-scheme")).rejects.toThrow();
  });

  it.each([
    "ko-Latn-google",
    "ru-Latn-google",
    "el-Latn-google",
    "th-Latn-google",
    "ar-Latn-google",
    "hi-Latn-google",
    "bn-Latn-google",
    "he-Latn-google",
  ])("creates a generator for %s", async (scheme) => {
    const gen = await createGoogleGenerator(scheme);
    expect(gen.scheme).toBe(scheme);
    expect(typeof gen.generateLine).toBe("function");
  });
});

describe("createGoogleGenerator: word-synced alignment", () => {
  it("returns wordTexts aligned to line.words for a Korean line", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => googleResponse("sa␞lang␞hae")),
    );
    const gen = await createGoogleGenerator("ko-Latn-google");
    const line: LyricLine = {
      id: "L1",
      text: "사랑해",
      agentId: "v1",
      words: [
        { text: "사", begin: 0, end: 1 },
        { text: "랑", begin: 1, end: 2 },
        { text: "해", begin: 2, end: 3 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(result.wordTexts).toEqual(["sa", "lang", "hae"]);
    expect(result.text).toBe("sa lang hae");
  });

  it("falls back to text-only when alignment fails (word count mismatch in Google response)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => googleResponse("sa lang")),
    );
    const gen = await createGoogleGenerator("ko-Latn-google");
    const line: LyricLine = {
      id: "L1",
      text: "사랑해",
      agentId: "v1",
      words: [
        { text: "사", begin: 0, end: 1 },
        { text: "랑", begin: 1, end: 2 },
        { text: "해", begin: 2, end: 3 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(result.wordTexts).toBeUndefined();
    expect(result.text).toBeTruthy();
  });
});

describe("createGoogleGenerator: line-synced fallback", () => {
  it("returns text-only when line has no words array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => googleResponse("annyeonghaseyo")),
    );
    const gen = await createGoogleGenerator("ko-Latn-google");
    const line: LyricLine = { id: "L1", text: "안녕하세요", agentId: "v1", begin: 0, end: 2 };
    const result = await gen.generateLine(line);
    expect(result.wordTexts).toBeUndefined();
    expect(result.text).toBeTruthy();
  });
});

describe("createGoogleGenerator: split character stripping", () => {
  it("strips pipes from source words before sending to Google", async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => googleResponse("sa␞rang"));
    vi.stubGlobal("fetch", fetchSpy);
    const gen = await createGoogleGenerator("ko-Latn-google");
    const line: LyricLine = {
      id: "L1",
      text: "사|랑",
      agentId: "v1",
      words: [
        { text: "사", begin: 0, end: 1 },
        { text: "|랑", begin: 1, end: 2 },
      ],
    };
    const result = await gen.generateLine(line);
    const init = fetchSpy.mock.calls[0][1];
    const body = String(init?.body ?? "");
    expect(decodeURIComponent(body.replace(/^q=/, ""))).toBe("사␞랑");
    expect(result.wordTexts).toEqual(["sa", "rang"]);
  });
});

describe("createGoogleGenerator: rate limit propagation", () => {
  it("propagates RateLimitError from the fetcher to the caller", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302 })),
    );
    const gen = await createGoogleGenerator("ko-Latn-google");
    const line: LyricLine = {
      id: "L1",
      text: "사랑해",
      agentId: "v1",
      words: [
        { text: "사", begin: 0, end: 1 },
        { text: "랑", begin: 1, end: 2 },
        { text: "해", begin: 2, end: 3 },
      ],
    };
    await expect(gen.generateLine(line)).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("createGoogleGenerator: ASCII passthrough", () => {
  it("returns ASCII-only line unchanged (no fetch)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const gen = await createGoogleGenerator("ko-Latn-google");
    const line: LyricLine = {
      id: "L1",
      text: "hello world",
      agentId: "v1",
      words: [
        { text: "hello", begin: 0, end: 1 },
        { text: "world", begin: 1, end: 2 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.text).toBe("hello world");
  });
});

describe("createGoogleGenerator: cache integration", () => {
  it("does not refetch words already in the cache from a prior call", async () => {
    const fetchSpy = vi.fn(async () => googleResponse("sa␞lang"));
    vi.stubGlobal("fetch", fetchSpy);
    const gen = await createGoogleGenerator("ko-Latn-google");
    const line: LyricLine = {
      id: "L1",
      text: "사랑",
      agentId: "v1",
      words: [
        { text: "사", begin: 0, end: 1 },
        { text: "랑", begin: 1, end: 2 },
      ],
    };
    await gen.generateLine(line);
    fetchSpy.mockClear();
    await gen.generateLine(line);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("createGoogleGenerator: invariant", () => {
  it("result.text equals result.wordTexts.join(' ') when both are present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => googleResponse("sa␞lang␞hae")),
    );
    const gen = await createGoogleGenerator("ko-Latn-google");
    const line: LyricLine = {
      id: "L1",
      text: "사랑해",
      agentId: "v1",
      words: [
        { text: "사", begin: 0, end: 1 },
        { text: "랑", begin: 1, end: 2 },
        { text: "해", begin: 2, end: 3 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(result.text).toBe(result.wordTexts!.join(" "));
  });
});
