// -- Constants ----------------------------------------------------------------

const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
const SEARCH_LIMIT = "25";
const LOOKUP_INCLUDES = [
  "isrcs",
  "releases",
  "release-groups",
  "artist-credits",
  "work-rels",
  "work-level-rels",
  "artist-rels",
];
const PHRASE_SPECIALS = /["\\]/g;

// -- Types --------------------------------------------------------------------

interface SongQuery {
  title: string;
  artist: string;
  isrc: string | null;
}

// -- Helpers ------------------------------------------------------------------

const phrase = (field: string, value: string): string => `${field}:"${value.trim().replace(PHRASE_SPECIALS, "\\$&")}"`;

function apiUrl(path: string): URL {
  const url = new URL(`${MUSICBRAINZ_API}${path}`);
  url.searchParams.set("fmt", "json");
  return url;
}

// -- URLs ---------------------------------------------------------------------

function songSearchUrl(query: SongQuery): string {
  if (query.isrc) {
    const url = apiUrl(`/isrc/${encodeURIComponent(query.isrc)}`);
    url.searchParams.set("inc", "artist-credits releases");
    return url.toString();
  }
  const clauses = [phrase("recording", query.title)];
  if (query.artist.trim()) clauses.push(phrase("artist", query.artist));
  const url = apiUrl("/recording");
  url.searchParams.set("query", clauses.join(" AND "));
  url.searchParams.set("limit", SEARCH_LIMIT);
  return url.toString();
}

function recordingLookupUrl(recordingId: string): string {
  const url = apiUrl(`/recording/${encodeURIComponent(recordingId)}`);
  url.searchParams.set("inc", LOOKUP_INCLUDES.join(" "));
  return url.toString();
}

// -- Exports ------------------------------------------------------------------

export { recordingLookupUrl, songSearchUrl };
export type { SongQuery };
