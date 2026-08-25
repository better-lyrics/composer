import type { LyricsSearchPayload, LyricsSearchResult } from "@/domain/lyrics-search/result";
import { detectQrcSyncType } from "@/domain/lyrics-search/sync-type";
import { LyricsSearchError, type LyricsSearchProvider, type LyricsSearchQuery } from "@/utils/lyrics-search/types";

// -- Constants ----------------------------------------------------------------

const QQ_BASE_URL = "https://lyrics-api.boidu.dev/qq/getLyrics";
const ID_PREFIX = "qq-";
const SOURCE_LABEL = "QQ Music";
const USER_AGENT = "Better Lyrics Composer (https://composer.betterlyrics.org)";
const RATE_LIMIT_MESSAGE = "QQ Music rate limit reached. Try again in a moment.";

// -- Types --------------------------------------------------------------------

interface QqLyricsResponse {
  lyrics: string;
  provider: string;
}

// -- Helpers ------------------------------------------------------------------

function hasNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUsableDuration(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function canSearch(query: LyricsSearchQuery): boolean {
  return hasNonEmptyString(query.track) && hasNonEmptyString(query.artist);
}

function buildSearchUrl(query: LyricsSearchQuery): URL {
  const url = new URL(QQ_BASE_URL);
  url.searchParams.set("song", (query.track ?? "").trim());
  url.searchParams.set("artist", (query.artist ?? "").trim());
  if (hasNonEmptyString(query.album)) url.searchParams.set("album", query.album.trim());
  if (hasUsableDuration(query.durationSec)) {
    url.searchParams.set("duration", Math.round(query.durationSec).toString());
  }
  if (hasNonEmptyString(query.videoId)) url.searchParams.set("videoId", query.videoId.trim());
  return url;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

function buildResult(query: LyricsSearchQuery, qrc: string): LyricsSearchResult {
  const track = (query.track ?? "").trim();
  const artist = (query.artist ?? "").trim();
  const payload: LyricsSearchPayload = { kind: "qrc", raw: qrc };

  return {
    id: `${ID_PREFIX}${track}-${artist}`.toLowerCase().replace(/\s+/g, "-"),
    source: "qq",
    sourceLabel: SOURCE_LABEL,
    syncType: detectQrcSyncType(qrc),
    track,
    artist,
    album: hasNonEmptyString(query.album) ? query.album.trim() : undefined,
    durationSec: hasUsableDuration(query.durationSec) ? Math.round(query.durationSec) : 0,
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
      throw new LyricsSearchError("qq", RATE_LIMIT_MESSAGE);
    }
    if (!response.ok) {
      throw new LyricsSearchError("qq", `${SOURCE_LABEL} returned ${response.status}`);
    }

    const body = (await response.json()) as QqLyricsResponse;
    if (!body || typeof body.lyrics !== "string" || body.lyrics.length === 0) return [];

    return [buildResult(query, body.lyrics)];
  } catch (error) {
    if (isAbortError(error)) return [];
    if (error instanceof LyricsSearchError) throw error;
    throw new LyricsSearchError("qq", `${SOURCE_LABEL} request failed`, error);
  }
}

// -- Provider -----------------------------------------------------------------

const qqProvider: LyricsSearchProvider = {
  name: "qq",
  sourceLabel: SOURCE_LABEL,
  canSearch,
  search,
};

// -- Exports ------------------------------------------------------------------

export { qqProvider };
