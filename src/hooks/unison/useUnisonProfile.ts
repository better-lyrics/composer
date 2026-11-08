import { useQuery } from "@tanstack/react-query";
import { unisonQueryKeys } from "@/hooks/unison/query-keys";
import { preloadKawarpImage } from "@/lib/kawarp-image-cache";
import type { UnisonProfile } from "@/lib/unison/api-types";
import { fetchProfile } from "@/lib/unison/endpoints";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonProfile]";
// Unison rebuilds the leaderboard behind these numbers every 5 minutes.
const PROFILE_STALE_TIME_MS = 5 * 60_000;

// -- Helpers -------------------------------------------------------------------

// The banner is decoded as soon as the profile arrives, so the Unison page paints it without a fade from black.
function warmBanner(profile: UnisonProfile): UnisonProfile {
  if (profile.banner) {
    preloadKawarpImage(profile.banner.artworkUrl).catch((error: unknown) =>
      console.warn(LOG_PREFIX, "could not preload the banner", error),
    );
  }
  return profile;
}

// -- Hook ----------------------------------------------------------------------

function useUnisonProfile(keyId: string) {
  return useQuery({
    queryKey: unisonQueryKeys.profile(keyId),
    queryFn: ({ signal }) => fetchProfile(keyId, { signal }).then(warmBanner),
    staleTime: PROFILE_STALE_TIME_MS,
  });
}

// -- Exports -------------------------------------------------------------------

export { useUnisonProfile };
