import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLoadYouTubeSource } from "@/hooks/useLoadYouTubeSource";
import { extractVideoId } from "@/utils/youtube-url";

// -- Constants ----------------------------------------------------------------

const YOUTUBE_PARAM = "youtube";

// -- Functions ----------------------------------------------------------------

function cleanYouTubeParamFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete(YOUTUBE_PARAM);
  const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") + url.hash;
  window.history.replaceState(null, "", next);
}

function useImportFromYouTube(): void {
  const loadYouTubeSource = useLoadYouTubeSource();
  const loadRef = useRef(loadYouTubeSource);
  loadRef.current = loadYouTubeSource;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(YOUTUBE_PARAM);
    if (!raw) return;

    const videoId = extractVideoId(raw);
    cleanYouTubeParamFromUrl();

    if (!videoId) {
      toast.error("That URL doesn't look like a valid YouTube video");
      return;
    }
    loadRef.current(videoId);
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useImportFromYouTube, YOUTUBE_PARAM };
