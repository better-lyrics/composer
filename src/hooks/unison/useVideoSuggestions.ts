import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import type { SongForSuggestions } from "@/lib/unison/api-types";
import { fetchVideoLinks, suggestVideosForLyric, suggestVideosForSong } from "@/lib/unison/endpoints";
import { useQuery } from "@tanstack/react-query";

// -- Hooks ---------------------------------------------------------------------

function useSongVideoSuggestions(song: SongForSuggestions | null) {
  return useQuery({
    queryKey: unisonQueryKeys.songVideoSuggestions(song),
    queryFn: ({ signal }) => (song ? suggestVideosForSong(song, { signal }) : []),
    staleTime: UNISON_STALE_TIME_MS,
    enabled: song !== null,
  });
}

function useLyricVideoSuggestions(lyricId: number) {
  return useQuery({
    queryKey: unisonQueryKeys.lyricVideoSuggestions(lyricId),
    queryFn: ({ signal }) => suggestVideosForLyric(lyricId, { signal }),
    staleTime: UNISON_STALE_TIME_MS,
  });
}

function useVideoLinks(lyricId: number) {
  return useQuery({
    queryKey: unisonQueryKeys.videoLinks(lyricId),
    queryFn: ({ signal }) => fetchVideoLinks(lyricId, { signal }),
    staleTime: UNISON_STALE_TIME_MS,
  });
}

// -- Exports -------------------------------------------------------------------

export { useLyricVideoSuggestions, useSongVideoSuggestions, useVideoLinks };
