import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getThumbFromBridge } from "@/utils/composer-bridge-api";

// -- Constants ----------------------------------------------------------------

const QUERY_KEY = "composer-bridge-thumb";

// -- Hook ---------------------------------------------------------------------

function useBridgeThumb(): void {
  const source = useAudioStore((s) => s.source);
  const bridgeEnabled = useSettingsStore((s) => s.experiments.youtubeBridge);
  const bridgeUrl = useSettingsStore((s) => s.composerBridgeUrl);
  const videoId = source?.type === "youtube" ? source.videoId : null;

  const query = useQuery<string | null>({
    queryKey: [QUERY_KEY, videoId, bridgeUrl],
    enabled: bridgeEnabled && videoId !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const thumb = await getThumbFromBridge(bridgeUrl, videoId as string, signal);
      return thumb ?? null;
    },
  });

  useEffect(() => {
    const thumb = query.data;
    if (!thumb || !videoId) return;
    let cancelled = false;
    void getPersistenceSettled().then(() => {
      if (cancelled) return;
      const current = useAudioStore.getState().source;
      if (current?.type !== "youtube" || current.videoId !== videoId) return;
      useProjectStore.getState().setMetadata({
        thumbnailDataUrl: thumb,
        thumbnailForVideoId: videoId,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [query.data, videoId]);
}

// -- Exports ------------------------------------------------------------------

export { useBridgeThumb };
