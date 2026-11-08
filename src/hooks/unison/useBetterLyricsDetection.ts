import { type QueryClient, useQuery } from "@tanstack/react-query";
import { unisonQueryKeys } from "@/hooks/unison/query-keys";
import { findBetterLyricsExtension } from "@/lib/unison/extension-port";

// -- Types ---------------------------------------------------------------------

type BetterLyricsDetectionState = "checking" | "ready" | "missing";

interface BetterLyricsDetection {
  state: BetterLyricsDetectionState;
  extensionId: string | null;
}

// -- Constants -----------------------------------------------------------------

// Installing the extension needs a reload, so one probe per page load is enough.
const DETECTION_QUERY = {
  queryKey: unisonQueryKeys.betterLyricsExtension(),
  queryFn: findBetterLyricsExtension,
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  retry: false,
} as const;

// -- Hooks ---------------------------------------------------------------------

function useBetterLyricsDetection(enabled: boolean): BetterLyricsDetection {
  const { data: extensionId } = useQuery({ ...DETECTION_QUERY, enabled });
  if (extensionId === undefined) return { state: "checking", extensionId: null };
  return extensionId === null ? { state: "missing", extensionId: null } : { state: "ready", extensionId };
}

// The probe's answer, waiting for it when it is still running.
function detectBetterLyrics(queryClient: QueryClient): Promise<string | null> {
  return queryClient.ensureQueryData(DETECTION_QUERY);
}

// -- Exports -------------------------------------------------------------------

export type { BetterLyricsDetection };
export { detectBetterLyrics, useBetterLyricsDetection };
