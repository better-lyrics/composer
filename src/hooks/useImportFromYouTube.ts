import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLoadYouTubeSource } from "@/hooks/useLoadYouTubeSource";
import { stripQueryParams } from "@/utils/url-params";
import { extractVideoId } from "@/utils/youtube-url";

// -- Constants ----------------------------------------------------------------

const YOUTUBE_PARAM_NAMES = ["youtube", "videoId", "v"] as const;

// -- Functions ----------------------------------------------------------------

function readYouTubeParam(params: URLSearchParams): string | null {
  for (const name of YOUTUBE_PARAM_NAMES) {
    const value = params.get(name);
    if (value) return value;
  }
  return null;
}

function cleanYouTubeParamsFromUrl(): void {
  stripQueryParams(YOUTUBE_PARAM_NAMES);
}

function useImportFromYouTube(): void {
  const loadYouTubeSource = useLoadYouTubeSource();
  const loadRef = useRef(loadYouTubeSource);
  loadRef.current = loadYouTubeSource;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = readYouTubeParam(params);
    if (!raw) return;

    const videoId = extractVideoId(raw);
    cleanYouTubeParamsFromUrl();

    if (!videoId) {
      toast.error("That URL doesn't look like a valid YouTube video");
      return;
    }
    loadRef.current(videoId).catch(() => {
      // Error is surfaced via useAudioStore.youtubeLoadError and the tunnel toast.
    });
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useImportFromYouTube };
