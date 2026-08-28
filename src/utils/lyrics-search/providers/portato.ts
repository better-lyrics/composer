import { hasUsableDuration } from "@/domain/lyrics-search/duration";
import type { LyricsSearchPayload, LyricsSearchResult } from "@/domain/lyrics-search/result";
import { detectQrcSyncType } from "@/domain/lyrics-search/sync-type";
import { isAbortError } from "@/utils/abort-error";
import { isClientError } from "@/utils/lyrics-search/http-status";
import { hasNonEmptyString } from "@/utils/lyrics-search/query-guards";
import { LyricsSearchError, type LyricsSearchProvider, type LyricsSearchQuery } from "@/utils/lyrics-search/types";

// -- Constants ----------------------------------------------------------------

const PORTATO_BASE_URL = "https://lyrics-api.boidu.dev/qq/getLyrics";
const ID_PREFIX = "qq-";
const SOURCE_LABEL = "Better Lyrics Portato";
const LOG_PREFIX = "[Portato]";
const USER_AGENT = "Better Lyrics Composer (https://composer.betterlyrics.org)";
const RATE_LIMIT_MESSAGE = "Better Lyrics Portato rate limit reached. Try again in a moment.";

// -- Types --------------------------------------------------------------------

interface QqLyricsResponse {
  lyrics: string;
  provider: string;
}

// -- Helpers ------------------------------------------------------------------

// The endpoint 404s on song + artist alone, so a query without album or duration cannot match at all.
function canSearch(query: LyricsSearchQuery): boolean {
  if (!hasNonEmptyString(query.track) || !hasNonEmptyString(query.artist)) return false;
  return hasNonEmptyString(query.album) || hasUsableDuration(query.durationSec);
}

function buildSearchUrl(query: LyricsSearchQuery): URL {
  const url = new URL(PORTATO_BASE_URL);
  url.searchParams.set("song", (query.track ?? "").trim());
  url.searchParams.set("artist", (query.artist ?? "").trim());
  if (hasNonEmptyString(query.album)) url.searchParams.set("album", query.album.trim());
  if (hasUsableDuration(query.durationSec)) {
    url.searchParams.set("duration", Math.round(query.durationSec).toString());
  }
  if (hasNonEmptyString(query.videoId)) url.searchParams.set("videoId", query.videoId.trim());
  return url;
}

function buildResult(query: LyricsSearchQuery, qrc: string): LyricsSearchResult {
  const track = (query.track ?? "").trim();
  const artist = (query.artist ?? "").trim();
  const payload: LyricsSearchPayload = { kind: "qrc", raw: qrc };

  return {
    id: `${ID_PREFIX}${track}-${artist}`.toLowerCase().replace(/\s+/g, "-"),
    source: "portato",
    sourceLabel: SOURCE_LABEL,
    syncType: detectQrcSyncType(qrc),
    track,
    artist,
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
    const response = await fetch(url.toString(), {
      signal,
      headers: { "User-Agent": USER_AGENT },
    });

    if (signal.aborted) return [];
    if (response.status === 404) return [];
    // A rate limit is not a miss: reporting it as "no results" would tell the user the lyrics do not exist.
    if (response.status === 429) {
      throw new LyricsSearchError("portato", RATE_LIMIT_MESSAGE);
    }
    if (isClientError(response.status)) {
      console.warn(LOG_PREFIX, `getLyrics returned ${response.status}, treating as no results`);
      return [];
    }
    if (!response.ok) {
      throw new LyricsSearchError("portato", `${SOURCE_LABEL} returned ${response.status}`);
    }

    const body = (await response.json()) as QqLyricsResponse;
    if (!body || typeof body.lyrics !== "string" || body.lyrics.length === 0) return [];

    return [buildResult(query, body.lyrics)];
  } catch (error) {
    if (isAbortError(error)) return [];
    if (error instanceof LyricsSearchError) throw error;
    throw new LyricsSearchError("portato", `${SOURCE_LABEL} request failed`, error);
  }
}

// -- Provider -----------------------------------------------------------------

const portatoProvider: LyricsSearchProvider = {
  name: "portato",
  sourceLabel: SOURCE_LABEL,
  canSearch,
  search,
};

// -- Exports ------------------------------------------------------------------

export { portatoProvider };
