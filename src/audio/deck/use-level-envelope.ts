import { hasLevelEnvelope, levelEnvelopeFor, levelEnvelopeForUrl } from "@/audio/audio-levels";
import type { LevelEnvelope } from "@/audio/level-envelope";
import { useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { fileIdentityKey } from "@/utils/file-identity";
import { useQuery } from "@tanstack/react-query";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[DeckLevels]";
const ANALYSIS_DELAY_MS = 1200;

// -- Helpers ------------------------------------------------------------------

// The decode waits until the song has settled in, so it never competes with loading it.
function afterLoadSettles(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ANALYSIS_DELAY_MS);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

// -- Hook ---------------------------------------------------------------------

function useLevelEnvelope(): LevelEnvelope | null {
  const file = useAudioStore((state) => state.source?.file ?? null);
  const currentStem = useSeparationStore((state) => state.currentStem);
  const stemUrl = useSeparationStore((state) =>
    state.currentStem === "original" ? undefined : state.stemUrls[state.currentStem],
  );
  const sourceKey = stemUrl ?? (file ? fileIdentityKey(file) : null);

  const { data } = useQuery({
    queryKey: ["level-envelope", currentStem, sourceKey],
    enabled: sourceKey !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      if (!stemUrl && file && !hasLevelEnvelope(file)) await afterLoadSettles(signal);
      try {
        if (stemUrl) return await levelEnvelopeForUrl(stemUrl, signal);
        if (file) return await levelEnvelopeFor(file, signal);
        return null;
      } catch (error) {
        if (signal.aborted) return null;
        console.warn(LOG_PREFIX, "level analysis failed", error);
        return null;
      }
    },
  });

  return data ?? null;
}

// -- Exports ------------------------------------------------------------------

export { useLevelEnvelope };
