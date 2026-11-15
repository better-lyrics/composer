import {
  YOUTUBE_TUNNEL_QUERY_KEY,
  type YouTubeDownloadProgress,
  downloadProgressSnapshot,
  subscribeDownloadProgress,
} from "@/audio/youtube-download";
import { useAudioStore } from "@/stores/audio";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

// -- Interfaces ---------------------------------------------------------------

interface YouTubeDownload {
  downloading: boolean;
  progress: YouTubeDownloadProgress | null;
  cancel: () => void;
}

// -- Hook ---------------------------------------------------------------------

function useYouTubeDownload(): YouTubeDownload {
  const queryClient = useQueryClient();
  const downloading = useIsFetching({ queryKey: [YOUTUBE_TUNNEL_QUERY_KEY] }) > 0;
  const progress = useSyncExternalStore(subscribeDownloadProgress, downloadProgressSnapshot);
  const cancel = useCallback(() => {
    void queryClient.cancelQueries({ queryKey: [YOUTUBE_TUNNEL_QUERY_KEY] });
    useAudioStore.getState().cancelYouTubeLoad();
  }, [queryClient]);
  return { downloading, progress, cancel };
}

// -- Exports ------------------------------------------------------------------

export { useYouTubeDownload };
