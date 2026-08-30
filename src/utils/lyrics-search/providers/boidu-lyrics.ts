import { hasUsableDuration } from "@/domain/lyrics-search/duration";
import type { LyricsSearchPayload, LyricsSearchResult } from "@/domain/lyrics-search/result";
import { detectTtmlSyncType } from "@/domain/lyrics-search/sync-type";
import { isAbortError } from "@/utils/abort-error";
import { isClientError } from "@/utils/lyrics-search/http-status";
import { hasNonEmptyString } from "@/utils/lyrics-search/query-guards";
import { LyricsSearchError, type LyricsSearchProvider, type LyricsSearchQuery } from "@/utils/lyrics-search/types";

// -- Constants ----------------------------------------------------------------

const BOIDU_BASE_URL = "https://lyrics-api.boidu.dev/getLyrics";
const ID_PREFIX = "boidu-lyrics-";
const LOG_PREFIX = "[BetterLyrics]";

// -- Types --------------------------------------------------------------------

interface BoiduLyricsResponse {
  ttml: string;
}

// -- Helpers ------------------------------------------------------------------

function canSearch(query: LyricsSearchQuery): boolean {
  return (
    hasNonEmptyString(query.track) &&
    hasNonEmptyString(query.artist) &&
    hasUsableDuration(query.durationSec) &&
    hasNonEmptyString(query.videoId)
  );
}

function buildSearchUrl(query: LyricsSearchQuery): URL {
  const url = new URL(BOIDU_BASE_URL);
  url.searchParams.set("s", (query.track ?? "").trim());
  url.searchParams.set("a", (query.artist ?? "").trim());
  url.searchParams.set("d", Math.round(query.durationSec as number).toString());
  url.searchParams.set("videoId", (query.videoId ?? "").trim());
  if (hasNonEmptyString(query.album)) url.searchParams.set("al", query.album.trim());
  return url;
}

function buildResult(query: LyricsSearchQuery, ttml: string): LyricsSearchResult {
  const payload: LyricsSearchPayload = { kind: "ttml", xml: ttml };
  return {
    id: `${ID_PREFIX}${(query.videoId ?? "").trim()}`,
    source: "boidu-lyrics",
    sourceLabel: "Better Lyrics",
    syncType: detectTtmlSyncType(ttml),
    track: (query.track ?? "").trim(),
    artist: (query.artist ?? "").trim(),
    album: hasNonEmptyString(query.album) ? query.album.trim() : undefined,
    payload,
  };
}

// -- Search -------------------------------------------------------------------

async function search(query: LyricsSearchQuery, signal: AbortSignal): Promise<LyricsSearchResult[]> {
  if (!canSearch(query)) return [];
  if (signal.aborted) return [];

  try {
    const url = buildSearchUrl(query);
    const response = await fetch(url.toString(), { signal });

    if (signal.aborted) return [];
    if (response.status === 404) return [];
    if (isClientError(response.status)) {
      console.warn(LOG_PREFIX, `getLyrics returned ${response.status}, treating as no results`);
      return [];
    }
    if (!response.ok) {
      throw new LyricsSearchError("boidu-lyrics", `Better Lyrics returned ${response.status}`);
    }

    const body = (await response.json()) as BoiduLyricsResponse;
    if (!body || typeof body.ttml !== "string" || body.ttml.length === 0) return [];

    return [buildResult(query, body.ttml)];
  } catch (error) {
    if (isAbortError(error)) return [];
    if (error instanceof LyricsSearchError) throw error;
    throw new LyricsSearchError("boidu-lyrics", "Better Lyrics request failed", error);
  }
}

// -- Provider -----------------------------------------------------------------

const boiduLyricsProvider: LyricsSearchProvider = {
  name: "boidu-lyrics",
  sourceLabel: "Better Lyrics",
  canSearch,
  search,
};

// -- Exports ------------------------------------------------------------------

export { boiduLyricsProvider };
