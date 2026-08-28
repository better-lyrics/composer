import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { binimumProvider } from "@/utils/lyrics-search/providers/binimum";
import { LyricsSearchError } from "@/utils/lyrics-search/types";

// -- Network gating -----------------------------------------------------------

const SKIP_NETWORK = process.env.SKIP_NETWORK_TESTS === "1";
const ONLINE_PROBE_URL = "https://lyrics-api.binimum.org/?track=test&artist=test";
const ONLINE_PROBE_TIMEOUT_MS = 5000;
const NETWORK_TEST_TIMEOUT_MS = 30000;
const TTML_URL_REGEX = /^https:\/\/lyrics-storage\.binimum\.org\/.+\.ttml$/;

let isOnline = true;

async function probeOnline(): Promise<boolean> {
  if (SKIP_NETWORK) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ONLINE_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(ONLINE_PROBE_URL, { signal: controller.signal });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const describeOnline = SKIP_NETWORK ? describe.skip : describe;

// -- Tests --------------------------------------------------------------------

describeOnline("binimumProvider", () => {
  beforeAll(async () => {
    isOnline = await probeOnline();
    if (!isOnline) {
      console.warn("[binimum.test] Binimum unreachable: tests will be skipped at runtime.");
    }
  }, ONLINE_PROBE_TIMEOUT_MS + 1000);

  afterAll(() => {
    isOnline = true;
  });

  function skipIfOffline(): boolean {
    return !isOnline;
  }

  // -- Metadata --------------------------------------------------------------

  describe("metadata", () => {
    it("identifies as binimum with the Binimum source label", () => {
      expect(binimumProvider.name).toBe("binimum");
      expect(binimumProvider.sourceLabel).toBe("Binimum");
    });
  });

  // -- canSearch -------------------------------------------------------------

  describe("canSearch", () => {
    it("returns false when query is empty", () => {
      expect(binimumProvider.canSearch({})).toBe(false);
    });

    it("returns false when only track is supplied", () => {
      expect(binimumProvider.canSearch({ track: "Bohemian Rhapsody" })).toBe(false);
    });

    it("returns false when only artist is supplied", () => {
      expect(binimumProvider.canSearch({ artist: "Queen" })).toBe(false);
    });

    it("returns false when track is whitespace only", () => {
      expect(binimumProvider.canSearch({ track: "   ", artist: "Queen" })).toBe(false);
    });

    it("returns false when artist is whitespace only", () => {
      expect(binimumProvider.canSearch({ track: "Imagine", artist: "  " })).toBe(false);
    });

    it("returns true when both track and artist are supplied", () => {
      expect(binimumProvider.canSearch({ track: "Imagine", artist: "John Lennon" })).toBe(true);
    });

    it("returns true when only a valid ISRC is supplied", () => {
      expect(binimumProvider.canSearch({ isrc: "GBUM71029604" })).toBe(true);
    });

    it("returns false when ISRC is invalidly formatted and track+artist missing", () => {
      expect(binimumProvider.canSearch({ isrc: "not-a-real-isrc" })).toBe(false);
    });

    it("falls back to track+artist requirement when ISRC is invalid", () => {
      expect(binimumProvider.canSearch({ track: "Imagine", artist: "John Lennon", isrc: "bad" })).toBe(true);
      expect(binimumProvider.canSearch({ isrc: "bad" })).toBe(false);
      expect(binimumProvider.canSearch({ track: "Imagine", isrc: "bad" })).toBe(false);
    });
  });

  // -- search: happy path ----------------------------------------------------

  describe("search happy paths", () => {
    it(
      "returns at least one Binimum result for a popular track + artist",
      async () => {
        if (skipIfOffline()) return;
        const controller = new AbortController();
        const results = await binimumProvider.search(
          { track: "Bohemian Rhapsody", artist: "Queen" },
          controller.signal,
        );
        expect(results.length).toBeGreaterThan(0);
        for (const result of results) {
          expect(result.source).toBe("binimum");
          expect(result.sourceLabel).toBe("Binimum");
          expect(result.payload.kind).toBe("deferred-ttml");
          if (result.payload.kind === "deferred-ttml") {
            expect(result.payload.fetchUrl).toMatch(TTML_URL_REGEX);
          }
        }
      },
      NETWORK_TEST_TIMEOUT_MS,
    );

    it(
      "uses the binimum- id prefix on every result",
      async () => {
        if (skipIfOffline()) return;
        const controller = new AbortController();
        const results = await binimumProvider.search(
          { track: "Bohemian Rhapsody", artist: "Queen" },
          controller.signal,
        );
        for (const result of results) {
          expect(result.id.startsWith("binimum-")).toBe(true);
        }
      },
      NETWORK_TEST_TIMEOUT_MS,
    );

    it(
      "maps timing_type values directly without lossy coercion",
      async () => {
        if (skipIfOffline()) return;
        const controller = new AbortController();
        const results = await binimumProvider.search(
          { track: "Bohemian Rhapsody", artist: "Queen" },
          controller.signal,
        );
        const observed = new Set(results.map((r) => r.syncType));
        for (const syncType of observed) {
          expect(["syllable", "word", "line"]).toContain(syncType);
        }
      },
      NETWORK_TEST_TIMEOUT_MS,
    );

    it(
      "keeps duration as an integer (Binimum returns whole seconds)",
      async () => {
        if (skipIfOffline()) return;
        const controller = new AbortController();
        const results = await binimumProvider.search(
          { track: "Bohemian Rhapsody", artist: "Queen" },
          controller.signal,
        );
        for (const result of results) {
          expect(Number.isInteger(result.durationSec)).toBe(true);
        }
      },
      NETWORK_TEST_TIMEOUT_MS,
    );

    it(
      "maps empty album_name to undefined",
      async () => {
        if (skipIfOffline()) return;
        const controller = new AbortController();
        const results = await binimumProvider.search(
          { track: "Bohemian Rhapsody", artist: "Queen" },
          controller.signal,
        );
        for (const result of results) {
          if (result.album === undefined) continue;
          expect(result.album.length).toBeGreaterThan(0);
        }
      },
      NETWORK_TEST_TIMEOUT_MS,
    );
  });

  // -- ISRC-only path --------------------------------------------------------

  describe("ISRC-only search", () => {
    it(
      "returns at least one result when only a valid ISRC is provided",
      async () => {
        if (skipIfOffline()) return;
        const controller = new AbortController();
        const results = await binimumProvider.search({ isrc: "GBUM71029604" }, controller.signal);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].source).toBe("binimum");
      },
      NETWORK_TEST_TIMEOUT_MS,
    );
  });

  // -- Empty / 404 -----------------------------------------------------------

  describe("empty result handling", () => {
    it(
      "returns [] on 404 from nonsense queries",
      async () => {
        if (skipIfOffline()) return;
        const controller = new AbortController();
        const results = await binimumProvider.search(
          { track: "xxasdkfjhasdkjfhasdkfjh", artist: "qwertyuiopzxcvbn" },
          controller.signal,
        );
        expect(results).toEqual([]);
      },
      NETWORK_TEST_TIMEOUT_MS,
    );
  });

  // -- Abort -----------------------------------------------------------------

  describe("abort handling", () => {
    it("resolves to [] when called with a pre-aborted signal", async () => {
      const controller = new AbortController();
      controller.abort();
      const results = await binimumProvider.search({ track: "Bohemian Rhapsody", artist: "Queen" }, controller.signal);
      expect(results).toEqual([]);
    });

    it(
      "resolves to [] when the signal aborts mid-fetch",
      async () => {
        if (skipIfOffline()) return;
        const controller = new AbortController();
        const pending = binimumProvider.search({ track: "Bohemian Rhapsody", artist: "Queen" }, controller.signal);
        controller.abort();
        const results = await pending;
        expect(results).toEqual([]);
      },
      NETWORK_TEST_TIMEOUT_MS,
    );
  });

  // -- Gate without canSearch ------------------------------------------------

  describe("when canSearch returns false", () => {
    it("returns [] immediately when track is missing", async () => {
      const controller = new AbortController();
      const results = await binimumProvider.search({ artist: "Queen" }, controller.signal);
      expect(results).toEqual([]);
    });

    it("returns [] immediately when artist is missing", async () => {
      const controller = new AbortController();
      const results = await binimumProvider.search({ track: "Imagine" }, controller.signal);
      expect(results).toEqual([]);
    });
  });

  // -- LyricsSearchError export contract -------------------------------------

  describe("LyricsSearchError contract", () => {
    it("constructs a LyricsSearchError with provider 'binimum'", () => {
      const error = new LyricsSearchError("binimum", "boom");
      expect(error.provider).toBe("binimum");
      expect(error.message).toBe("boom");
      expect(error.name).toBe("LyricsSearchError");
    });
  });
});

// -- Duration mapping (stubbed transport, never reaches the network) ----------

describe("binimumProvider duration mapping", () => {
  const SEARCH_HIT = {
    id: "0a1b2c3d",
    track_name: "Bohemian Rhapsody",
    artist_name: "Queen",
    album_name: "A Night at the Opera",
    isrc: "GBUM71029604",
    timing_type: "line",
    lyricsUrl: "https://lyrics-storage.binimum.org/0a1b2c3d.ttml",
  } as const;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubSearchBody(body: unknown): void {
    vi.stubGlobal(
      "fetch",
      async (): Promise<Response> =>
        new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
    );
  }

  async function searchWithDuration(hit: Record<string, unknown>): Promise<number | undefined> {
    stubSearchBody({ total: 1, source: "binimum", results: [hit] });
    const results = await binimumProvider.search(
      { track: "Bohemian Rhapsody", artist: "Queen" },
      new AbortController().signal,
    );
    expect(results).toHaveLength(1);
    return results[0].durationSec;
  }

  it("rounds a usable duration to whole seconds", async () => {
    expect(await searchWithDuration({ ...SEARCH_HIT, duration: 354.6 })).toBe(355);
  });

  it("reports no duration when the response omits the field", async () => {
    expect(await searchWithDuration({ ...SEARCH_HIT })).toBeUndefined();
  });

  it("reports no duration when the response sends null", async () => {
    expect(await searchWithDuration({ ...SEARCH_HIT, duration: null })).toBeUndefined();
  });

  it("reports no duration when the response sends a non-numeric value", async () => {
    expect(await searchWithDuration({ ...SEARCH_HIT, duration: "355" })).toBeUndefined();
    expect(await searchWithDuration({ ...SEARCH_HIT, duration: 0 })).toBeUndefined();
  });
});

// -- 4xx status handling (stubbed transport) ----------------------------------

describe("binimumProvider 4xx handling", () => {
  const QUERY = { track: "Bohemian Rhapsody", artist: "Queen" } as const;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubStatus(status: number): void {
    vi.stubGlobal("fetch", async (): Promise<Response> => new Response("body", { status }));
  }

  it.each([400, 401, 403, 422, 429])("returns [] without throwing on %i", async (status) => {
    stubStatus(status);
    const results = await binimumProvider.search(QUERY, new AbortController().signal);
    expect(results).toEqual([]);
  });

  it("logs a warning on a non-404 4xx instead of surfacing an error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubStatus(403);
    await binimumProvider.search(QUERY, new AbortController().signal);
    expect(warn).toHaveBeenCalled();
  });

  it("stays silent on a plain 404 miss", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubStatus(404);
    const results = await binimumProvider.search(QUERY, new AbortController().signal);
    expect(results).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("still throws a LyricsSearchError on 5xx", async () => {
    stubStatus(503);
    await expect(binimumProvider.search(QUERY, new AbortController().signal)).rejects.toBeInstanceOf(LyricsSearchError);
  });
});
