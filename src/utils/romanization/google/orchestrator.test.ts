import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleCache } from "@/utils/romanization/google/cache";
import { RateLimitError, romanizeLinesViaGoogle } from "@/utils/romanization/google/orchestrator";

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let cache: GoogleCache;
const passthroughThrottle = <T>(fn: () => Promise<T>): Promise<T> => fn();

beforeEach(async () => {
  cache = new GoogleCache({ maxEntries: 1_000, dbName: `orch-${Date.now()}-${Math.random()}` });
  await cache.open();
  await cache.clearForTests();
  vi.restoreAllMocks();
});

afterEach(async () => {
  await cache.close();
});

function googleResponse(romaji: string): Response {
  return new Response(JSON.stringify([[[null, null, null, romaji]]]), { status: 200 });
}

describe("romanizeLinesViaGoogle: all-cached", () => {
  it("returns cached romaji without any fetch when every word is in cache", async () => {
    await cache.setMany("ko", [
      ["사", "sa"],
      ["랑", "lang"],
      ["해", "hae"],
    ]);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [["사", "랑", "해"]],
      cache,
      throttle: passthroughThrottle,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual([["sa", "lang", "hae"]]);
  });

  it("returns empty result for empty input without any fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [],
      cache,
      throttle: passthroughThrottle,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

describe("romanizeLinesViaGoogle: partial cache", () => {
  it("batches only the uncached words into a single request", async () => {
    await cache.set("ko", "사", "sa");
    const fetchSpy = vi.fn<FetchMock>(async () => googleResponse("lang␞hae"));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [["사", "랑", "해"]],
      cache,
      throttle: passthroughThrottle,
    });
    expect(result).toEqual([["sa", "lang", "hae"]]);
    const body = String(fetchSpy.mock.calls[0][1]?.body);
    expect(body).not.toContain(encodeURIComponent("사"));
    expect(body).toContain(encodeURIComponent("랑"));
    expect(body).toContain(encodeURIComponent("해"));
  });

  it("writes successful fetch results back into the cache", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => googleResponse("sa␞lang␞hae")),
    );
    await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [["사", "랑", "해"]],
      cache,
      throttle: passthroughThrottle,
    });
    expect(await cache.get("ko", "사")).toBe("sa");
    expect(await cache.get("ko", "랑")).toBe("lang");
    expect(await cache.get("ko", "해")).toBe("hae");
  });

  it("scopes cache reads/writes by source lang", async () => {
    await cache.set("ja", "夜", "yoru");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => googleResponse("annyeong")),
    );
    const result = await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [["안녕"]],
      cache,
      throttle: passthroughThrottle,
    });
    expect(result).toEqual([["annyeong"]]);
    expect(await cache.get("ja", "夜")).toBe("yoru");
    expect(await cache.get("ja", "안녕")).toBeUndefined();
  });

  it("correctly slot-accounts when cached and uncached words are interleaved in a line", async () => {
    await cache.set("ko", "A", "a");
    await cache.set("ko", "C", "c");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => googleResponse("b␞d")),
    );
    const result = await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [["A", "B", "C", "D"]],
      cache,
      throttle: passthroughThrottle,
    });
    expect(result).toEqual([["a", "b", "c", "d"]]);
    expect(await cache.get("ko", "B")).toBe("b");
    expect(await cache.get("ko", "D")).toBe("d");
  });
});

describe("romanizeLinesViaGoogle: multi-line batches", () => {
  it("packs all uncached words from multiple lines into one request when small enough", async () => {
    const fetchSpy = vi.fn(async () => googleResponse("sa␞lang␞hae\n\n␝\n\nneo␞leul"));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [
        ["사", "랑", "해"],
        ["너", "를"],
      ],
      cache,
      throttle: passthroughThrottle,
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result).toEqual([
      ["sa", "lang", "hae"],
      ["neo", "leul"],
    ]);
  });

  it("splits a batch into multiple requests when total body exceeds maxBody", async () => {
    const big = "x".repeat(6_000);
    const responses = [googleResponse(`${big}1\n\n␝\n\n${big}2`), googleResponse(`${big}3`)];
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => responses[call++]),
    );
    const result = await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [[big], [big], [big]],
      cache,
      throttle: passthroughThrottle,
      maxBody: 15_000,
    });
    expect(call).toBe(2);
    expect(result).toHaveLength(3);
  });

  it("skips lines that are fully cached when collecting uncached batches", async () => {
    await cache.setMany("ko", [
      ["사", "sa"],
      ["랑", "lang"],
      ["해", "hae"],
    ]);
    const fetchSpy = vi.fn<FetchMock>(async () => googleResponse("neo␞leul"));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [
        ["사", "랑", "해"],
        ["너", "를"],
      ],
      cache,
      throttle: passthroughThrottle,
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = String(fetchSpy.mock.calls[0][1]?.body);
    expect(body).not.toContain(encodeURIComponent("사"));
    expect(body).not.toContain(encodeURIComponent("랑"));
    expect(body).not.toContain(encodeURIComponent("해"));
    expect(result).toEqual([
      ["sa", "lang", "hae"],
      ["neo", "leul"],
    ]);
  });
});

describe("romanizeLinesViaGoogle: failure isolation", () => {
  it("returns null for a line whose response word count is wrong but keeps siblings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => googleResponse("sa␞lang\n\n␝\n\nneo␞leul")),
    );
    const result = await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [
        ["사", "랑", "해"],
        ["너", "를"],
      ],
      cache,
      throttle: passthroughThrottle,
    });
    expect(result[0]).toBeNull();
    expect(result[1]).toEqual(["neo", "leul"]);
  });

  it("propagates RateLimitError when fetch returns 302", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302 })),
    );
    await expect(
      romanizeLinesViaGoogle({
        sourceLang: "ko",
        lines: [["사"]],
        cache,
        throttle: passthroughThrottle,
      }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("marks a chunk's lines null on non-rate-limit fetch failure but processes other chunks", async () => {
    const big = "x".repeat(8_000);
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (call++ === 0) return new Response("<html>500</html>", { status: 200 });
        return googleResponse("ok");
      }),
    );
    const result = await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [[big], [big]],
      cache,
      throttle: passthroughThrottle,
      maxBody: 15_000,
    });
    expect(result[0]).toBeNull();
    expect(result[1]).toEqual(["ok"]);
  });

  it("does not write to cache when a chunk fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>500</html>", { status: 200 })),
    );
    await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [["사", "랑"]],
      cache,
      throttle: passthroughThrottle,
    });
    expect(await cache.get("ko", "사")).toBeUndefined();
    expect(await cache.get("ko", "랑")).toBeUndefined();
  });
});

describe("romanizeLinesViaGoogle: throttle integration", () => {
  it("each fetch call passes through the throttle helper", async () => {
    const throttleSpy = vi.fn();
    const throttle = <T>(fn: () => Promise<T>): Promise<T> => {
      throttleSpy();
      return fn();
    };
    vi.stubGlobal(
      "fetch",
      vi.fn<FetchMock>(async () => googleResponse("annyeong")),
    );
    await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [["안녕"]],
      cache,
      throttle,
    });
    expect(throttleSpy).toHaveBeenCalledTimes(1);
  });

  it("multiple chunks all go through the throttle", async () => {
    const big = "x".repeat(8_000);
    const throttleSpy = vi.fn();
    const throttle = <T>(fn: () => Promise<T>): Promise<T> => {
      throttleSpy();
      return fn();
    };
    vi.stubGlobal(
      "fetch",
      vi.fn<FetchMock>(async () => googleResponse("o")),
    );
    await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [[big], [big]],
      cache,
      throttle,
      maxBody: 15_000,
    });
    expect(throttleSpy).toHaveBeenCalledTimes(2);
  });

  it("does not call throttle when every word is cached", async () => {
    await cache.set("ko", "안녕", "annyeong");
    const throttleSpy = vi.fn();
    const throttle = <T>(fn: () => Promise<T>): Promise<T> => {
      throttleSpy();
      return fn();
    };
    vi.stubGlobal("fetch", vi.fn<FetchMock>());
    await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [["안녕"]],
      cache,
      throttle,
    });
    expect(throttleSpy).not.toHaveBeenCalled();
  });
});

describe("romanizeLinesViaGoogle: signal forwarding", () => {
  it("forwards the AbortSignal to the fetcher", async () => {
    const controller = new AbortController();
    const fetchSpy = vi.fn<FetchMock>(async (_url, init) => {
      expect(init?.signal).toBe(controller.signal);
      return googleResponse("annyeong");
    });
    vi.stubGlobal("fetch", fetchSpy);
    await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [["안녕"]],
      cache,
      throttle: passthroughThrottle,
      signal: controller.signal,
    });
  });
});

describe("romanizeLinesViaGoogle: cache identity", () => {
  it("does not refetch words it just wrote to the cache (idempotent within a session)", async () => {
    const fetchSpy = vi.fn(async () => googleResponse("sa␞lang"));
    vi.stubGlobal("fetch", fetchSpy);
    await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [["사", "랑"]],
      cache,
      throttle: passthroughThrottle,
    });
    fetchSpy.mockClear();
    const result = await romanizeLinesViaGoogle({
      sourceLang: "ko",
      lines: [["사", "랑"]],
      cache,
      throttle: passthroughThrottle,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual([["sa", "lang"]]);
  });
});
