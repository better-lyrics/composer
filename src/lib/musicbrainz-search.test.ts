import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMusicBrainzQueue } from "@/lib/musicbrainz-client";
import { searchRecordings } from "@/lib/musicbrainz-search";
import { YOUR_POWER_SEARCH } from "@/test/musicbrainz-search-fixtures";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("searchRecordings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMusicBrainzQueue();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("regressions", () => {
    it("regression: falls back to title and artist when MusicBrainz does not know the ISRC", async () => {
      const requested: string[] = [];
      vi.stubGlobal("fetch", async (url: string) => {
        requested.push(new URL(url).pathname);
        return url.includes("/isrc/") ? json({ error: "Not Found" }, 404) : json(YOUR_POWER_SEARCH);
      });
      const result = searchRecordings({ title: "Your Power", artist: "Billie Eilish", isrc: "ZZZZZ9999999" });
      await vi.runAllTimersAsync();
      await expect(result).resolves.toEqual(YOUR_POWER_SEARCH);
      expect(requested).toEqual(["/ws/2/isrc/ZZZZZ9999999", "/ws/2/recording"]);
    });
  });

  describe("error paths", () => {
    it("still fails on a server error from the ISRC endpoint", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("fetch", async () => json({}, 500));
      const assertion = expect(
        searchRecordings({ title: "Your Power", artist: "Billie Eilish", isrc: "ZZZZZ9999999" }),
      ).rejects.toThrow("500");
      await vi.runAllTimersAsync();
      await assertion;
    });
  });
});
