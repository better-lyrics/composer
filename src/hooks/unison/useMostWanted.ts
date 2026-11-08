import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { fetchMostWanted } from "@/lib/unison/endpoints";
import { useInfiniteQuery } from "@tanstack/react-query";

// -- Constants -----------------------------------------------------------------

const FIRST_PAGE_CURSOR = "";

// -- Hook ----------------------------------------------------------------------

function useMostWanted() {
  return useInfiniteQuery({
    queryKey: unisonQueryKeys.mostWanted(),
    queryFn: ({ pageParam, signal }) => fetchMostWanted({ cursor: pageParam, signal }),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: UNISON_STALE_TIME_MS,
  });
}

// -- Exports -------------------------------------------------------------------

export { useMostWanted };
