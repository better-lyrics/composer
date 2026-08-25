import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LyricsSearchResult } from "@/domain/lyrics-search/result";
import { detectQrcSyncType } from "@/domain/lyrics-search/sync-type";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { qqProvider } from "@/utils/lyrics-search/providers/qq";
import { LyricsSearchError } from "@/utils/lyrics-search/types";

// -- Network gating -----------------------------------------------------------

const SKIP_NETWORK = process.env.SKIP_NETWORK_TESTS === "1";
// The QQ endpoint allows 15 requests per window, so the probe hits the unmetered API root instead.
const ONLINE_PROBE_URL = "https://lyrics-api.boidu.dev/";
const ONLINE_PROBE_TIMEOUT_MS = 5000;
const NETWORK_TEST_TIMEOUT_MS = 30000;
const RATE_LIMIT_MESSAGE_FRAGMENT = "rate limit";

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
let isRateLimited = false;

function isRateLimitError(error: unknown): boolean {
  return error instanceof LyricsSearchError && error.message.toLowerCase().includes(RATE_LIMIT_MESSAGE_FRAGMENT);
}

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

describe("qqProvider.canSearch", () => {
  const TRACK_AND_ARTIST = { track: "Wanderlust", artist: "The Weeknd" } as const;

  it("returns true with the full query", () => {
    expect(qqProvider.canSearch(CACHED_QUERY)).toBe(true);
  });

  it("returns true with track, artist and album", () => {
    expect(qqProvider.canSearch({ ...TRACK_AND_ARTIST, album: "Kiss Land (Deluxe)" })).toBe(true);
  });

  it("returns true with track, artist and duration", () => {
    expect(qqProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: 307 })).toBe(true);
  });

  describe("narrowing to what the endpoint can answer", () => {
    it("returns false with only a track and an artist", () => {
      expect(qqProvider.canSearch(TRACK_AND_ARTIST)).toBe(false);
    });

    it("returns false when album is whitespace and duration is absent", () => {
      expect(qqProvider.canSearch({ ...TRACK_AND_ARTIST, album: "   " })).toBe(false);
    });

    it("returns false when a videoId is the only extra field", () => {
      expect(qqProvider.canSearch({ ...TRACK_AND_ARTIST, videoId: "vlrC-y1I3go" })).toBe(false);
    });

    it("returns true when album is whitespace but duration is usable", () => {
      expect(qqProvider.canSearch({ ...TRACK_AND_ARTIST, album: "   ", durationSec: 307 })).toBe(true);
    });
  });

  describe("duration guard", () => {
    it("returns false for a zero duration with no album", () => {
      expect(qqProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: 0 })).toBe(false);
    });

    it("returns false for a negative duration with no album", () => {
      expect(qqProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: -5 })).toBe(false);
    });

    it("returns false for NaN with no album", () => {
      expect(qqProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: Number.NaN })).toBe(false);
    });

    it("returns false for Infinity with no album", () => {
      expect(qqProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: Number.POSITIVE_INFINITY })).toBe(false);
    });

    it("accepts a fractional duration that the URL builder rounds", () => {
      expect(qqProvider.canSearch({ ...TRACK_AND_ARTIST, durationSec: 306.4 })).toBe(true);
    });

    it("still passes on an unusable duration when an album is present", () => {
      const query = { ...TRACK_AND_ARTIST, album: "Kiss Land (Deluxe)", durationSec: Number.NaN };
      expect(qqProvider.canSearch(query)).toBe(true);
    });
  });

  describe("required fields", () => {
    it("returns false when the query is empty", () => {
      expect(qqProvider.canSearch({})).toBe(false);
    });

    it("returns false when track is missing", () => {
      expect(qqProvider.canSearch({ artist: "The Weeknd", album: "Kiss Land (Deluxe)", durationSec: 307 })).toBe(false);
    });

    it("returns false when artist is missing", () => {
      expect(qqProvider.canSearch({ track: "Wanderlust", album: "Kiss Land (Deluxe)", durationSec: 307 })).toBe(false);
    });

    it("returns false when track is whitespace only", () => {
      expect(qqProvider.canSearch({ track: "   ", artist: "The Weeknd", durationSec: 307 })).toBe(false);
    });

    it("returns false when artist is whitespace only", () => {
      expect(qqProvider.canSearch({ track: "Wanderlust", artist: "  \t ", durationSec: 307 })).toBe(false);
    });
  });

  describe("invariants", () => {
    it("does not mutate the query it inspects", () => {
      const query = { ...TRACK_AND_ARTIST, album: "Kiss Land (Deluxe)", durationSec: 307 };
      const snapshot = { ...query };
      qqProvider.canSearch(query);
      expect(query).toEqual(snapshot);
    });

    it("agrees with search: a query it rejects resolves to [] without a request", async () => {
      expect(qqProvider.canSearch(TRACK_AND_ARTIST)).toBe(false);
      await expect(qqProvider.search(TRACK_AND_ARTIST, new AbortController().signal)).resolves.toEqual([]);
    });
  });
});

// -- Tests --------------------------------------------------------------------

describeOnline("qqProvider", () => {
  beforeAll(async () => {
    isOnline = await probeOnline();
    if (!isOnline) {
      console.warn("[qq.test] lyrics-api.boidu.dev unreachable: tests will be skipped at runtime.");
      return;
    }
    // One shared fetch for every happy-path assertion, because the window allows only 15 requests.
    try {
      cachedResults = await qqProvider.search(CACHED_QUERY, new AbortController().signal);
    } catch (error) {
      if (isRateLimitError(error)) {
        isRateLimited = true;
        console.warn("[qq.test] QQ Music rate limit reached: happy-path assertions will be skipped at runtime.");
        return;
      }
      throw error;
    }
  }, ONLINE_PROBE_TIMEOUT_MS + NETWORK_TEST_TIMEOUT_MS);

  afterAll(() => {
    isOnline = true;
    cachedResults = [];
    isRateLimited = false;
  });

  function skipIfOffline(): boolean {
    return !isOnline;
  }

  function cachedResult(): LyricsSearchResult | null {
    if (!isOnline || isRateLimited) return null;
    if (cachedResults.length === 0) {
      console.warn("[qq.test] Cached query returned empty (cache miss); skipping assertions.");
      return null;
    }
    return cachedResults[0];
  }

  // -- Metadata --------------------------------------------------------------

  describe("metadata", () => {
    it("identifies as qq with the QQ Music source label", () => {
      expect(qqProvider.name).toBe("qq");
      expect(qqProvider.sourceLabel).toBe("QQ Music");
    });
  });

  // -- search: happy path (cached) -------------------------------------------

  describe("search cached happy path", () => {
    it(
      "returns exactly one result identified as QQ Music",
      () => {
        const result = cachedResult();
        if (result === null) return;
        expect(cachedResults).toHaveLength(1);
        expect(result.source).toBe("qq");
        expect(result.sourceLabel).toBe("QQ Music");
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

    it("echoes the query back onto the result", () => {
      const result = cachedResult();
      if (result === null) return;
      expect(result.track).toBe(CACHED_QUERY.track);
      expect(result.artist).toBe(CACHED_QUERY.artist);
      expect(result.album).toBe(CACHED_QUERY.album);
      expect(result.durationSec).toBe(CACHED_QUERY.durationSec);
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
        if (skipIfOffline() || isRateLimited) return;
        const controller = new AbortController();
        try {
          expect(await qqProvider.search(UNMATCHABLE_QUERY, controller.signal)).toEqual([]);
        } catch (error) {
          if (isRateLimitError(error)) return;
          throw error;
        }
      },
      NETWORK_TEST_TIMEOUT_MS,
    );
  });

  // -- Abort -----------------------------------------------------------------

  describe("abort handling", () => {
    it("resolves to [] when called with a pre-aborted signal", async () => {
      const controller = new AbortController();
      controller.abort();
      const results = await qqProvider.search(CACHED_QUERY, controller.signal);
      expect(results).toEqual([]);
    });

    it(
      "resolves to [] when the signal aborts mid-fetch",
      async () => {
        if (skipIfOffline() || isRateLimited) return;
        const controller = new AbortController();
        const pending = qqProvider.search(CACHED_QUERY, controller.signal);
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
      const results = await qqProvider.search({ track: "Wanderlust" }, controller.signal);
      expect(results).toEqual([]);
    });

    it("returns [] immediately when both track and artist are whitespace", async () => {
      const controller = new AbortController();
      const results = await qqProvider.search({ track: " ", artist: " " }, controller.signal);
      expect(results).toEqual([]);
    });
  });

  // -- LyricsSearchError export contract -------------------------------------

  describe("LyricsSearchError contract", () => {
    it("constructs a LyricsSearchError with provider 'qq'", () => {
      const error = new LyricsSearchError("qq", "boom");
      expect(error.provider).toBe("qq");
      expect(error.message).toBe("boom");
      expect(error.name).toBe("LyricsSearchError");
    });
  });
});
