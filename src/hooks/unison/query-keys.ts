import type { QueryClient } from "@tanstack/react-query";
import type { SongForSuggestions } from "@/lib/unison/api-types";

// -- Keys ----------------------------------------------------------------------

const UNISON_QUERY_ROOT = "unison";

const unisonQueryKeys = {
  betterLyricsExtension: () => [UNISON_QUERY_ROOT, "better-lyrics-extension"] as const,
  mine: (keyId: string) => [UNISON_QUERY_ROOT, "mine", keyId] as const,
  mineForLibrary: (keyId: string, linkedIds: readonly string[], loadAll: boolean, everyPage: boolean) =>
    [UNISON_QUERY_ROOT, "mine", keyId, "library", linkedIds, loadAll, everyPage] as const,
  contentLinks: (candidates: readonly (readonly string[])[]) =>
    [UNISON_QUERY_ROOT, "content-links", candidates] as const,
  profile: (keyId: string) => [UNISON_QUERY_ROOT, "profile", keyId] as const,
  mostWanted: () => [UNISON_QUERY_ROOT, "most-wanted"] as const,
  allSearches: () => [UNISON_QUERY_ROOT, "search"] as const,
  search: (query: string) => [UNISON_QUERY_ROOT, "search", query] as const,
  lyric: (id: number) => [UNISON_QUERY_ROOT, "lyric", id] as const,
  allVariants: () => [UNISON_QUERY_ROOT, "variants"] as const,
  variants: (videoId: string) => [UNISON_QUERY_ROOT, "variants", videoId] as const,
  revisions: (id: number) => [UNISON_QUERY_ROOT, "revisions", id] as const,
  revisionDiff: (id: number, revId: number, againstRevId: number | null) =>
    [UNISON_QUERY_ROOT, "revisions", id, "diff", revId, againstRevId] as const,
  revision: (id: number, revId: number) => [UNISON_QUERY_ROOT, "revisions", id, "content", revId] as const,
  revisionPreviews: (id: number) => [UNISON_QUERY_ROOT, "revision-preview", id] as const,
  revisionPreview: (id: number, inputHash: string) => [UNISON_QUERY_ROOT, "revision-preview", id, inputHash] as const,
  revisionSameAsLive: (id: number, inputHash: string) =>
    [UNISON_QUERY_ROOT, "revision-preview", id, inputHash, "same-as-live"] as const,
  videoLinks: (id: number) => [UNISON_QUERY_ROOT, "video-links", id] as const,
  songVideoSuggestions: (song: SongForSuggestions | null) =>
    [UNISON_QUERY_ROOT, "video-suggestions", "song", song] as const,
  lyricVideoSuggestions: (id: number) => [UNISON_QUERY_ROOT, "video-suggestions", "lyric", id] as const,
};

// -- Constants -----------------------------------------------------------------

const UNISON_STALE_TIME_MS = 60_000;

// -- Invalidation --------------------------------------------------------------

// Every write to a lyric changes it, the account's list, the song's variants, revisions, update preview, wanted list and search.
function invalidateLyricWrite(queryClient: QueryClient, lyricId: number, keyId: string): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: unisonQueryKeys.lyric(lyricId) }),
    queryClient.invalidateQueries({ queryKey: unisonQueryKeys.mine(keyId) }),
    queryClient.invalidateQueries({ queryKey: unisonQueryKeys.revisions(lyricId), exact: true }),
    queryClient.invalidateQueries({ queryKey: unisonQueryKeys.revisionPreviews(lyricId) }),
    queryClient.invalidateQueries({ queryKey: unisonQueryKeys.allVariants() }),
    queryClient.invalidateQueries({ queryKey: unisonQueryKeys.mostWanted() }),
    queryClient.invalidateQueries({ queryKey: unisonQueryKeys.allSearches() }),
  ]);
}

// -- Exports -------------------------------------------------------------------

export { invalidateLyricWrite, UNISON_STALE_TIME_MS, unisonQueryKeys };
