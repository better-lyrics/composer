import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import type { UnisonVariant } from "@/lib/unison/api-types";
import { UnisonError } from "@/lib/unison/client";
import { fetchVariants } from "@/lib/unison/endpoints";
import { useQuery } from "@tanstack/react-query";

// -- Constants -----------------------------------------------------------------

const NOT_FOUND_STATUS = 404;

// -- Functions -----------------------------------------------------------------

// Unison answers 404 when a video has no lyrics yet.
async function fetchVariantsOrNone(videoId: string, signal: AbortSignal): Promise<UnisonVariant[]> {
  try {
    return await fetchVariants(videoId, { signal });
  } catch (error) {
    if (error instanceof UnisonError && error.status === NOT_FOUND_STATUS) return [];
    throw error;
  }
}

// -- Hook ----------------------------------------------------------------------

function useUnisonVariants(videoId: string | undefined) {
  return useQuery({
    queryKey: unisonQueryKeys.variants(videoId ?? ""),
    queryFn: ({ signal }) => fetchVariantsOrNone(videoId ?? "", signal),
    staleTime: UNISON_STALE_TIME_MS,
    enabled: videoId !== undefined,
  });
}

// -- Exports -------------------------------------------------------------------

export { useUnisonVariants };
