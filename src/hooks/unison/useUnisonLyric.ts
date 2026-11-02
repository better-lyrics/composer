import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { fetchLyric } from "@/lib/unison/endpoints";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { type QueryClient, useQuery } from "@tanstack/react-query";

// -- Queries -------------------------------------------------------------------

function unisonLyricQuery(id: number) {
  return {
    queryKey: unisonQueryKeys.lyric(id),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchLyric(id, { signal }),
    staleTime: UNISON_STALE_TIME_MS,
  };
}

function fetchUnisonLyric(queryClient: QueryClient, id: number): Promise<UnisonLyric> {
  return queryClient.fetchQuery(unisonLyricQuery(id));
}

// -- Hook ----------------------------------------------------------------------

function useUnisonLyric(id: number | null) {
  return useQuery({ ...unisonLyricQuery(id ?? 0), enabled: id !== null });
}

// -- Exports -------------------------------------------------------------------

export { fetchUnisonLyric, useUnisonLyric };
