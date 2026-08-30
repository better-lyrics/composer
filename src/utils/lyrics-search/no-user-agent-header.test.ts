import { afterEach, describe, expect, it, vi } from "vitest";
import { getProviders } from "@/utils/lyrics-search/registry";
import type { LyricsSearchQuery } from "@/utils/lyrics-search/types";

// Firefox honors a JS-set User-Agent on cross-origin fetch, which promotes the
// request to a CORS preflight the lyrics APIs reject (Chrome strips it, so it
// only breaks on Firefox). No provider may send this header. See issue: Firefox
// search failing with "header 'user-agent' is not allowed" CORS errors.

// -- Fixtures -----------------------------------------------------------------

const FULL_QUERY: LyricsSearchQuery = {
  track: "Your Power",
  artist: "Billie Eilish",
  album: "Happier Than Ever",
  durationSec: 246,
  videoId: "5DEPXcDysro",
  isrc: "USUM72104782",
};

function headerNamesFrom(init: RequestInit | undefined): string[] {
  const headers = init?.headers;
  if (!headers) return [];
  if (headers instanceof Headers) return [...headers.keys()];
  if (Array.isArray(headers)) return headers.map(([name]) => name);
  return Object.keys(headers);
}

// -- Tests --------------------------------------------------------------------

describe("lyrics-search providers do not set a User-Agent header (Firefox CORS)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  for (const provider of getProviders()) {
    it(`regression: ${provider.name} never sends a User-Agent request header`, async () => {
      const sentHeaderNames: string[] = [];
      vi.stubGlobal("fetch", async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        sentHeaderNames.push(...headerNamesFrom(init));
        return new Response("{}", { headers: { "content-type": "application/json" } });
      });

      await provider.search(FULL_QUERY, new AbortController().signal);

      const lowerCased = sentHeaderNames.map((name) => name.toLowerCase());
      expect(lowerCased).not.toContain("user-agent");
    });
  }
});
