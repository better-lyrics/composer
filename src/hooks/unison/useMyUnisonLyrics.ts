import { useQuery } from "@tanstack/react-query";
import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { fetchMinePages } from "@/lib/unison/endpoints";

// -- Hook ----------------------------------------------------------------------

function useMyUnisonLyrics(keyId: string | null) {
  return useQuery({
    queryKey: unisonQueryKeys.mine(keyId ?? ""),
    queryFn: ({ signal }) => fetchMinePages(signal),
    staleTime: UNISON_STALE_TIME_MS,
    enabled: keyId !== null,
  });
}

// -- Exports -------------------------------------------------------------------

export { useMyUnisonLyrics };
