import { readYouTubeParam } from "@/utils/youtube-link-params";

// -- Types --------------------------------------------------------------------

interface LinkLocation {
  search: string;
  hash: string;
}

// -- Constants ----------------------------------------------------------------

const SONG_QUERY_PARAM_NAMES = ["title", "artist", "album", "duration", "isrc"] as const;
const IMPORT_HASH_PREFIX = "#import=";

// -- Params -------------------------------------------------------------------

function readTrimmed(params: URLSearchParams, name: string): string | null {
  const raw = params.get(name);
  if (raw === null) return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

// -- Detection ----------------------------------------------------------------

function hasIncomingLink({ search, hash }: LinkLocation): boolean {
  if (hash.startsWith(IMPORT_HASH_PREFIX)) return true;
  const params = new URLSearchParams(search);
  if (readYouTubeParam(params) !== null) return true;
  return SONG_QUERY_PARAM_NAMES.some((name) => readTrimmed(params, name) !== null);
}

// -- Exports ------------------------------------------------------------------

export { SONG_QUERY_PARAM_NAMES, IMPORT_HASH_PREFIX, hasIncomingLink, readTrimmed };
