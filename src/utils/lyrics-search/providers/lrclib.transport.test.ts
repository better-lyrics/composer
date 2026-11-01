import { lrclibProvider } from "@/utils/lyrics-search/providers/lrclib";
import type { LyricsSearchQuery } from "@/utils/lyrics-search/types";
import { afterEach, describe, expect, it, vi } from "vitest";

// -- Fixtures -----------------------------------------------------------------

type Route = (url: URL, init?: RequestInit) => Promise<Response>;

const FULL_QUERY: LyricsSearchQuery = {
  track: "  Bohemian Rhapsody ",
  artist: " Queen ",
  album: " A Night at the Opera  ",
  durationSec: 354.6,
};

function hit(id: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    trackName: "Bohemian Rhapsody",
    artistName: "Queen",
    albumName: "A Night at the Opera",
    duration: 355,
    instrumental: false,
    plainLyrics: "Is this the real life?",
    syncedLyrics: "[00:00.00] Is this the real life?",
    ...overrides,
  };
}

function json(body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }));
}

function stubRoutes(routes: { search?: Route; get?: Route }): URL[] {
  const requested: URL[] = [];
  vi.stubGlobal("fetch", (input: string, init?: RequestInit) => {
    const url = new URL(input);
    requested.push(url);
    const route = url.pathname === "/api/get" ? routes.get : routes.search;
    if (!route) throw new Error(`Unexpected request to ${url.pathname}`);
    return route(url, init);
  });
  return requested;
}

const search = (query: LyricsSearchQuery, signal = new AbortController().signal) =>
  lrclibProvider.search(query, signal);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// -- Tests --------------------------------------------------------------------

describe("lrclibProvider transport", () => {
  describe("merging", () => {
    it("puts the /api/get exact match first", async () => {
      stubRoutes({ search: () => json([hit(2), hit(3)]), get: () => json(hit(1)) });
      const results = await search(FULL_QUERY);
      expect(results.map((result) => result.id)).toEqual(["lrclib-1", "lrclib-2", "lrclib-3"]);
    });

    it("dedupes when /api/get and /api/search return the same id", async () => {
      stubRoutes({ search: () => json([hit(1), hit(2)]), get: () => json(hit(1)) });
      const results = await search(FULL_QUERY);
      expect(results.map((result) => result.id)).toEqual(["lrclib-1", "lrclib-2"]);
    });

    it("ignores a rejected /api/get while /api/search still returns results", async () => {
      stubRoutes({ search: () => json([hit(2)]), get: () => Promise.reject(new TypeError("Failed to fetch")) });
      const results = await search(FULL_QUERY);
      expect(results.map((result) => result.id)).toEqual(["lrclib-2"]);
    });
  });

  describe("mapping", () => {
    it("prefixes the id, labels the source and carries an lrc payload", async () => {
      stubRoutes({ search: () => json([hit(42)]) });
      const [result] = await search({ track: "Bohemian Rhapsody" });
      expect(result.id).toBe("lrclib-42");
      expect(result.source).toBe("lrclib");
      expect(result.sourceLabel).toBe("LRCLib");
      expect(result.payload).toEqual({
        kind: "lrc",
        synced: "[00:00.00] Is this the real life?",
        plain: "Is this the real life?",
      });
    });

    it("maps plain-only lyrics to unsynced", async () => {
      stubRoutes({ search: () => json([hit(7, { syncedLyrics: null })]) });
      const [result] = await search({ track: "Bohemian Rhapsody" });
      expect(result.syncType).toBe("unsynced");
    });

    it("drops a result whose lyrics are both null", async () => {
      stubRoutes({ search: () => json([hit(7, { syncedLyrics: null, plainLyrics: null }), hit(8)]) });
      const results = await search({ track: "Bohemian Rhapsody" });
      expect(results.map((result) => result.id)).toEqual(["lrclib-8"]);
    });
  });

  describe("requests", () => {
    it("runs /api/get with trimmed fields and a rounded duration when all are present", async () => {
      const requested = stubRoutes({ search: () => json([]), get: () => json(hit(1)) });
      await search(FULL_QUERY);
      const get = requested.find((url) => url.pathname === "/api/get");
      expect(get?.origin).toBe("https://lrclib.net");
      expect(Object.fromEntries(get?.searchParams ?? [])).toEqual({
        track_name: "Bohemian Rhapsody",
        artist_name: "Queen",
        album_name: "A Night at the Opera",
        duration: "355",
      });
      const searchUrl = requested.find((url) => url.pathname === "/api/search");
      expect(searchUrl?.searchParams.get("track_name")).toBe("Bohemian Rhapsody");
      expect(searchUrl?.searchParams.get("duration")).toBe("355");
    });

    it.each([
      ["artist", { ...FULL_QUERY, artist: undefined }],
      ["album", { ...FULL_QUERY, album: "  " }],
      ["duration", { ...FULL_QUERY, durationSec: undefined }],
      ["a finite duration", { ...FULL_QUERY, durationSec: Number.NaN }],
    ])("skips /api/get without %s", async (_missing, query) => {
      const requested = stubRoutes({ search: () => json([hit(2)]) });
      await search(query);
      expect(requested.map((url) => url.pathname)).toEqual(["/api/search"]);
    });

    it("ignores isrc", async () => {
      const requested = stubRoutes({ search: () => json([hit(2)]) });
      await search({ track: "Bohemian Rhapsody", isrc: "GBUM71029604" });
      expect(requested).toHaveLength(1);
      expect([...requested[0].searchParams.keys()]).toEqual(["track_name"]);
    });
  });

  describe("error paths", () => {
    it("returns [] when the request is aborted mid-fetch", async () => {
      const controller = new AbortController();
      stubRoutes({
        search: () => {
          controller.abort();
          return json([hit(2)]);
        },
      });
      expect(await search({ track: "Bohemian Rhapsody" }, controller.signal)).toEqual([]);
    });

    it("returns [] and warns on a network TypeError from /api/search", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      stubRoutes({ search: () => Promise.reject(new TypeError("Failed to fetch")) });
      expect(await search({ track: "Bohemian Rhapsody" })).toEqual([]);
      expect(warn).toHaveBeenCalled();
    });

    it("returns [] for a non-array /api/search body", async () => {
      stubRoutes({ search: () => json({ results: [hit(2)] }) });
      expect(await search({ track: "Bohemian Rhapsody" })).toEqual([]);
    });
  });
});
