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
  const { data: extensionId } = useQuery({
    queryKey: unisonQueryKeys.betterLyricsExtension(),
    queryFn: findBetterLyricsExtension,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
    enabled,
  });
  if (extensionId === undefined) return { state: "checking", extensionId: null };
  return extensionId === null ? { state: "missing", extensionId: null } : { state: "ready", extensionId };
}

// -- Exports -------------------------------------------------------------------

export { useBetterLyricsDetection };
export type { BetterLyricsDetection };
