// -- Keys ----------------------------------------------------------------------

const UNISON_QUERY_ROOT = "unison";

const unisonQueryKeys = {
  betterLyricsExtension: () => [UNISON_QUERY_ROOT, "better-lyrics-extension"] as const,
  mine: (keyId: string) => [UNISON_QUERY_ROOT, "mine", keyId] as const,
  mostWanted: () => [UNISON_QUERY_ROOT, "most-wanted"] as const,
  search: (query: string) => [UNISON_QUERY_ROOT, "search", query] as const,
  lyric: (id: number) => [UNISON_QUERY_ROOT, "lyric", id] as const,
};

// -- Constants -----------------------------------------------------------------

const UNISON_STALE_TIME_MS = 60_000;

// -- Exports -------------------------------------------------------------------

export { UNISON_STALE_TIME_MS, unisonQueryKeys };
