// -- Keys ----------------------------------------------------------------------

const UNISON_QUERY_ROOT = "unison";

const unisonQueryKeys = {
  betterLyricsExtension: () => [UNISON_QUERY_ROOT, "better-lyrics-extension"] as const,
  mine: (keyId: string) => [UNISON_QUERY_ROOT, "mine", keyId] as const,
  mineForLibrary: (keyId: string, linkedIds: readonly string[]) =>
    [UNISON_QUERY_ROOT, "mine", keyId, "library", linkedIds] as const,
  mostWanted: () => [UNISON_QUERY_ROOT, "most-wanted"] as const,
  search: (query: string) => [UNISON_QUERY_ROOT, "search", query] as const,
  lyric: (id: number) => [UNISON_QUERY_ROOT, "lyric", id] as const,
  allVariants: () => [UNISON_QUERY_ROOT, "variants"] as const,
  variants: (videoId: string) => [UNISON_QUERY_ROOT, "variants", videoId] as const,
  revisionPreviews: (id: number) => [UNISON_QUERY_ROOT, "revision-preview", id] as const,
  revisionPreview: (id: number, inputHash: string) => [UNISON_QUERY_ROOT, "revision-preview", id, inputHash] as const,
};

// -- Constants -----------------------------------------------------------------

const UNISON_STALE_TIME_MS = 60_000;

// -- Exports -------------------------------------------------------------------

export { UNISON_STALE_TIME_MS, unisonQueryKeys };
