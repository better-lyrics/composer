import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useEnsureAuth } from "@/hooks/useEnsureAuth";
import { useAudioStore } from "@/stores/audio";
import { CobaltApiError, getAudio } from "@/utils/cobalt-api";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[YouTubeTunnel]";

// -- Module state -------------------------------------------------------------

const inFlightVideoIds = new Set<string>();

// -- Hook ---------------------------------------------------------------------

function useResolveYouTubeTunnel(): void {
  const ensureAuth = useEnsureAuth();
  const ensureRef = useRef(ensureAuth);
  ensureRef.current = ensureAuth;

  useEffect(() => {
    const handleSourceChange = (videoId: string) => {
      if (inFlightVideoIds.has(videoId)) return;
      inFlightVideoIds.add(videoId);
      useAudioStore.getState().setIsLoading(true);

      ensureRef
        .current()
        .then((jwt) => getAudio(videoId, jwt))
        .then(({ tunnelUrl, expiresAt }) => {
          const current = useAudioStore.getState().source;
          if (current?.type === "youtube" && current.videoId === videoId) {
            useAudioStore.getState().setYouTubeTunnel(tunnelUrl, expiresAt);
          }
        })
        .catch((err) => {
          console.error(LOG_PREFIX, "tunnel fetch failed", err);
          const message = err instanceof CobaltApiError ? err.message : "Couldn't load YouTube audio";
          toast.error(message);
          const current = useAudioStore.getState().source;
          if (current?.type === "youtube" && current.videoId === videoId) {
            useAudioStore.getState().setSource(null);
          }
        })
        .finally(() => {
          inFlightVideoIds.delete(videoId);
          useAudioStore.getState().setIsLoading(false);
        });
    };

    const initial = useAudioStore.getState().source;
    if (initial?.type === "youtube" && !initial.tunnelUrl) {
      handleSourceChange(initial.videoId);
    }

    return useAudioStore.subscribe((state, prev) => {
      if (state.source === prev.source) return;
      if (state.source?.type !== "youtube") return;
      if (state.source.tunnelUrl) return;
      handleSourceChange(state.source.videoId);
    });
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useResolveYouTubeTunnel };
