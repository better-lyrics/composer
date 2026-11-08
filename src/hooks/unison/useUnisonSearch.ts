import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { searchLyrics } from "@/lib/unison/endpoints";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

// -- Constants -----------------------------------------------------------------

const SEARCH_DEBOUNCE_MS = 350;

// -- Hook ----------------------------------------------------------------------

function useUnisonSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const search = useQuery({
    queryKey: unisonQueryKeys.search(debouncedQuery),
    queryFn: ({ signal }) => searchLyrics(debouncedQuery, { signal }),
    staleTime: UNISON_STALE_TIME_MS,
    enabled: debouncedQuery !== "",
    placeholderData: keepPreviousData,
  });
  return { ...search, searchedQuery: debouncedQuery };
}

// -- Exports -------------------------------------------------------------------

export { useUnisonSearch };
