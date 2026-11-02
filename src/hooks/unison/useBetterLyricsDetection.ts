import { unisonQueryKeys } from "@/hooks/unison/query-keys";
import { findBetterLyricsExtension } from "@/lib/unison/extension-port";
import { useQuery } from "@tanstack/react-query";

// -- Types ---------------------------------------------------------------------

type BetterLyricsDetectionState = "checking" | "ready" | "missing";

interface BetterLyricsDetection {
  state: BetterLyricsDetectionState;
  extensionId: string | null;
}

// -- Hooks ---------------------------------------------------------------------

// Installing the extension needs a reload, so one probe per page load is enough.
function useBetterLyricsDetection(enabled: boolean): BetterLyricsDetection {
  const { data } = useQuery({
    queryKey: unisonQueryKeys.betterLyricsExtension(),
    queryFn: findBetterLyricsExtension,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
    enabled,
  });
  if (data === undefined) return { state: "checking", extensionId: null };
  return data === null ? { state: "missing", extensionId: null } : { state: "ready", extensionId: data };
}

// -- Exports -------------------------------------------------------------------

export { useBetterLyricsDetection };
export type { BetterLyricsDetection, BetterLyricsDetectionState };
