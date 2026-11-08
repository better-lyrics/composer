import { unisonQueryKeys } from "@/hooks/unison/query-keys";
import { fetchProfile } from "@/lib/unison/endpoints";
import { useQuery } from "@tanstack/react-query";

// -- Constants -----------------------------------------------------------------

// Unison rebuilds the leaderboard behind these numbers every 5 minutes.
const PROFILE_STALE_TIME_MS = 5 * 60_000;

// -- Hook ----------------------------------------------------------------------

function useUnisonProfile(keyId: string) {
  return useQuery({
    queryKey: unisonQueryKeys.profile(keyId),
    queryFn: ({ signal }) => fetchProfile(keyId, { signal }),
    staleTime: PROFILE_STALE_TIME_MS,
  });
}

// -- Exports -------------------------------------------------------------------

export { useUnisonProfile };
