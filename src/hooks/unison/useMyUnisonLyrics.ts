import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { fetchMine } from "@/lib/unison/endpoints";
import { useInfiniteQuery } from "@tanstack/react-query";

// -- Constants -----------------------------------------------------------------

const FIRST_PAGE_CURSOR = "";

// -- Hook ----------------------------------------------------------------------

function useMyUnisonLyrics(keyId: string | null) {
  return useInfiniteQuery({
    queryKey: unisonQueryKeys.mine(keyId ?? ""),
    queryFn: ({ pageParam, signal }) => fetchMine({ cursor: pageParam || undefined, signal }),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: UNISON_STALE_TIME_MS,
    enabled: keyId !== null,
  });
}

// -- Exports -------------------------------------------------------------------

export { useMyUnisonLyrics };
