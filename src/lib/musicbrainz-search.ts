import { type SongQuery, songSearchUrl } from "@/domain/musicbrainz/query";
import type { MbSearchResponse } from "@/domain/musicbrainz/types";
import { MusicBrainzHttpError, fetchMusicBrainz } from "@/lib/musicbrainz-client";

// -- Constants ----------------------------------------------------------------

const NOT_FOUND_STATUS = 404;

// -- Search -------------------------------------------------------------------

const isNotFound = (error: unknown): boolean =>
  error instanceof MusicBrainzHttpError && error.status === NOT_FOUND_STATUS;

async function searchRecordings(query: SongQuery, signal?: AbortSignal): Promise<MbSearchResponse> {
  if (query.isrc) {
    try {
      return await fetchMusicBrainz<MbSearchResponse>(songSearchUrl(query), signal);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  return fetchMusicBrainz<MbSearchResponse>(songSearchUrl({ ...query, isrc: null }), signal);
}

// -- Exports ------------------------------------------------------------------

export { searchRecordings };
