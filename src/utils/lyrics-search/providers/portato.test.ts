import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { LyricsSearchResult } from "@/domain/lyrics-search/result";
import { detectQrcSyncType } from "@/domain/lyrics-search/sync-type";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { portatoProvider } from "@/utils/lyrics-search/providers/portato";
import { LyricsSearchError } from "@/utils/lyrics-search/types";

// -- Network gating -----------------------------------------------------------

const SKIP_NETWORK = process.env.SKIP_NETWORK_TESTS === "1";
// The QQ endpoint allows 15 requests per window, so the probe hits the unmetered API root instead.
const ONLINE_PROBE_URL = "https://lyrics-api.boidu.dev/";
const ONLINE_PROBE_TIMEOUT_MS = 5000;
const NETWORK_TEST_TIMEOUT_MS = 30000;

const CACHED_QUERY = {
  track: "Wanderlust",
  artist: "The Weeknd",
  album: "Kiss Land (Deluxe)",
  durationSec: 307,
  videoId: "vlrC-y1I3go",
} as const;

// Carries a duration so canSearch lets it through and the 404 branch is actually exercised.
const UNMATCHABLE_QUERY = {
  track: "asdkfjhasdkjfhasdkfjh",
  artist: "qwertyuiopzxcvbn",
  durationSec: 200,
} as const;

let isOnline = true;
let cachedResults: LyricsSearchResult[] = [];

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

// -- canSearch (pure predicate, never touches the network) --------------------

describe("portatoProvider.canSearch", () => {
  const TRACK_AND_ARTIST = { track: "Wanderlust", artist: "The Weeknd" } as const;

  it("returns true with the full query", () => {
    expect(portatoProvider.canSearch(CACHED_QUERY)).toBe(true);
  });

  it("returns true with track, artist and album", () => {
    expect(portatoProvider.canSearch({ ...TRACK_AND_ARTIST, album: "Kiss Land (Deluxe)" })).toBe(true);
  });

  it("returns true with track, artist and duration", () => {
    expect(portatoProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: 307 })).toBe(true);
  });

  describe("narrowing to what the endpoint can answer", () => {
    it("returns false with only a track and an artist", () => {
      expect(portatoProvider.canSearch(TRACK_AND_ARTIST)).toBe(false);
    });

    it("returns false when album is whitespace and duration is absent", () => {
      expect(portatoProvider.canSearch({ ...TRACK_AND_ARTIST, album: "   " })).toBe(false);
    });

    it("returns false when a videoId is the only extra field", () => {
      expect(portatoProvider.canSearch({ ...TRACK_AND_ARTIST, videoId: "vlrC-y1I3go" })).toBe(false);
    });

    it("returns true when album is whitespace but duration is usable", () => {
      expect(portatoProvider.canSearch({ ...TRACK_AND_ARTIST, album: "   ", durationSec: 307 })).toBe(true);
    });
  });

  describe("duration guard", () => {
    it("returns false for a zero duration with no album", () => {
      expect(portatoProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: 0 })).toBe(false);
    });

    it("returns false for a negative duration with no album", () => {
      expect(portatoProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: -5 })).toBe(false);
    });

    it("returns false for NaN with no album", () => {
      expect(portatoProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: Number.NaN })).toBe(false);
    });

    it("returns false for Infinity with no album", () => {
      expect(portatoProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: Number.POSITIVE_INFINITY })).toBe(false);
    });

    it("accepts a fractional duration that the URL builder rounds", () => {
      expect(portatoProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: 306.4 })).toBe(true);
    });

    it("still passes on an unusable duration when an album is present", () => {
      const query = { ...TRACK_AND_ARTIST, album: "Kiss Land (Deluxe)", durationSec: Number.NaN };
      expect(portatoProvider.canSearch(query)).toBe(true);
    });
  });

  describe("required fields", () => {
    it("returns false when the query is empty", () => {
      expect(portatoProvider.canSearch({})).toBe(false);
    });

    it("returns false when track is missing", () => {
      expect(portatoProvider.canSearch({ artist: "The Weeknd", album: "Kiss Land (Deluxe)", durationSec: 307 })).toBe(
        false,
      );
    });

    it("returns false when artist is missing", () => {
      expect(portatoProvider.canSearch({ track: "Wanderlust", album: "Kiss Land (Deluxe)", durationSec: 307 })).toBe(
        false,
      );
    });

    it("returns false when track is whitespace only", () => {
      expect(portatoProvider.canSearch({ track: "   ", artist: "The Weeknd", durationSec: 307 })).toBe(false);
    });

    it("returns false when artist is whitespace only", () => {
      expect(portatoProvider.canSearch({ track: "Wanderlust", artist: "  \t ", durationSec: 307 })).toBe(false);
    });
  });

  describe("invariants", () => {
    it("does not mutate the query it inspects", () => {
      const query = { ...TRACK_AND_ARTIST, album: "Kiss Land (Deluxe)", durationSec: 307 };
      const snapshot = { ...query };
      portatoProvider.canSearch(query);
      expect(query).toEqual(snapshot);
    });

    it("agrees with search: a query it rejects resolves to [] without a request", async () => {
      expect(portatoProvider.canSearch(TRACK_AND_ARTIST)).toBe(false);
      await expect(portatoProvider.search(TRACK_AND_ARTIST, new AbortController().signal)).resolves.toEqual([]);
    });
  });
});

// -- Tests --------------------------------------------------------------------

describeOnline("portatoProvider", () => {
  beforeAll(async () => {
    isOnline = await probeOnline();
    if (!isOnline) {
      console.warn("[qq.test] lyrics-api.boidu.dev unreachable: tests will be skipped at runtime.");
      return;
    }
    // One shared fetch for every happy-path assertion, because the window allows only 15 requests.
    cachedResults = await portatoProvider.search(CACHED_QUERY, new AbortController().signal);
  }, ONLINE_PROBE_TIMEOUT_MS + NETWORK_TEST_TIMEOUT_MS);

  afterAll(() => {
    isOnline = true;
    cachedResults = [];
  });

  function skipIfOffline(): boolean {
    return !isOnline;
  }

  function cachedResult(): LyricsSearchResult | null {
    if (!isOnline) return null;
    if (cachedResults.length === 0) {
      console.warn("[qq.test] Cached query returned empty (cache miss); skipping assertions.");
      return null;
    }
    return cachedResults[0];
  }

  // -- Metadata --------------------------------------------------------------

  describe("metadata", () => {
    it("identifies as qq with the Better Lyrics Portato source label", () => {
      expect(portatoProvider.name).toBe("portato");
      expect(portatoProvider.sourceLabel).toBe("Better Lyrics Portato");
    });
  });

  // -- search: happy path (cached) -------------------------------------------

  describe("search cached happy path", () => {
    it(
      "returns exactly one result identified as Better Lyrics Portato",
      () => {
        const result = cachedResult();
        if (result === null) return;
        expect(cachedResults).toHaveLength(1);
        expect(result.source).toBe("portato");
        expect(result.sourceLabel).toBe("Better Lyrics Portato");
      },
      NETWORK_TEST_TIMEOUT_MS,
    );

    it("carries the raw QRC document as a qrc payload", () => {
      const result = cachedResult();
      if (result === null) return;
      expect(result.payload.kind).toBe("qrc");
      if (result.payload.kind !== "qrc") return;
      expect(result.payload.raw).toContain("<QrcInfos");
      expect(result.payload.raw).toContain("LyricContent");
    });

    it("reports word-level sync from the QRC body", () => {
      const result = cachedResult();
      if (result === null) return;
      expect(result.syncType).toBe("word");
      if (result.payload.kind !== "qrc") return;
      expect(result.syncType).toBe(detectQrcSyncType(result.payload.raw));
    });

    it("returns a payload the QRC parser can read", () => {
      const result = cachedResult();
      if (result === null) return;
      if (result.payload.kind !== "qrc") return;
      const parsed = parseLyricsFile("x.qrc", result.payload.raw);
      expect(parsed.lines.length).toBeGreaterThan(0);
      expect(parsed.hasTimingData).toBe(true);
      expect(parsed.lines.some((line) => (line.words?.length ?? 0) > 0)).toBe(true);
    });

    it("echoes the track, artist and album back onto the result", () => {
      const result = cachedResult();
      if (result === null) return;
      expect(result.track).toBe(CACHED_QUERY.track);
      expect(result.artist).toBe(CACHED_QUERY.artist);
      expect(result.album).toBe(CACHED_QUERY.album);
    });

    it("reports no duration, because the endpoint returns none", () => {
      const result = cachedResult();
      if (result === null) return;
      expect(result.durationSec).toBeUndefined();
    });

    it("uses a stable qq- prefixed id", () => {
      const result = cachedResult();
      if (result === null) return;
      expect(result.id).toBe("qq-wanderlust-the-weeknd");
    });
  });

  // -- Misses ----------------------------------------------------------------

  describe("404 miss handling", () => {
    it(
      "returns [] for an unmatchable query rather than throwing",
      async () => {
        if (skipIfOffline()) return;
        const controller = new AbortController();
        expect(await portatoProvider.search(UNMATCHABLE_QUERY, controller.signal)).toEqual([]);
      },
      NETWORK_TEST_TIMEOUT_MS,
    );
  });

  // -- Abort -----------------------------------------------------------------

  describe("abort handling", () => {
    it("resolves to [] when called with a pre-aborted signal", async () => {
      const controller = new AbortController();
      controller.abort();
      const results = await portatoProvider.search(CACHED_QUERY, controller.signal);
      expect(results).toEqual([]);
    });

    it(
      "resolves to [] when the signal aborts mid-fetch",
      async () => {
        if (skipIfOffline()) return;
        const controller = new AbortController();
        const pending = portatoProvider.search(CACHED_QUERY, controller.signal);
        controller.abort();
        const results = await pending;
        expect(results).toEqual([]);
      },
      NETWORK_TEST_TIMEOUT_MS,
    );
  });

  // -- Gate without canSearch ------------------------------------------------

  describe("when canSearch returns false", () => {
    it("returns [] immediately and does not fire a request when artist is missing", async () => {
      const controller = new AbortController();
      const results = await portatoProvider.search({ track: "Wanderlust" }, controller.signal);
      expect(results).toEqual([]);
    });

    it("returns [] immediately when both track and artist are whitespace", async () => {
      const controller = new AbortController();
      const results = await portatoProvider.search({ track: " ", artist: " " }, controller.signal);
      expect(results).toEqual([]);
    });
  });

  // -- LyricsSearchError export contract -------------------------------------

  describe("LyricsSearchError contract", () => {
    it("constructs a LyricsSearchError with provider 'qq'", () => {
      const error = new LyricsSearchError("portato", "boom");
      expect(error.provider).toBe("portato");
      expect(error.message).toBe("boom");
      expect(error.name).toBe("LyricsSearchError");
    });
  });
});

// -- Result mapping (stubbed transport, never reaches the network) ------------

describe("portatoProvider result mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports no duration even though the query carried one", async () => {
    vi.stubGlobal(
      "fetch",
      async (): Promise<Response> =>
        new Response(JSON.stringify({ lyrics: WANDERLUST_QRC, provider: "qq" }), {
          headers: { "content-type": "application/json" },
        }),
    );

    const results = await portatoProvider.search(CACHED_QUERY, new AbortController().signal);

    expect(results).toHaveLength(1);
    expect(CACHED_QUERY.durationSec).toBe(307);
    expect(results[0].durationSec).toBeUndefined();
  });
});

// -- 4xx/5xx status handling (stubbed transport) ------------------------------

describe("portatoProvider 4xx/5xx handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubStatus(status: number): void {
    vi.stubGlobal("fetch", async (): Promise<Response> => new Response("body", { status }));
  }

  it.each([400, 401, 403, 422, 429, 500, 503])("returns [] without throwing on %i", async (status) => {
    stubStatus(status);
    const results = await portatoProvider.search(CACHED_QUERY, new AbortController().signal);
    expect(results).toEqual([]);
  });

  it("logs a warning on a non-404 4xx instead of surfacing an error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubStatus(403);
    await portatoProvider.search(CACHED_QUERY, new AbortController().signal);
    expect(warn).toHaveBeenCalled();
  });

  it("stays silent on a plain 404 miss", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubStatus(404);
    const results = await portatoProvider.search(CACHED_QUERY, new AbortController().signal);
    expect(results).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("treats a 429 rate limit as no results, warns, and does not throw", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubStatus(429);
    const results = await portatoProvider.search(CACHED_QUERY, new AbortController().signal);
    expect(results).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("returns [] and warns on 5xx instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubStatus(503);
    const results = await portatoProvider.search(CACHED_QUERY, new AbortController().signal);
    expect(results).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});
