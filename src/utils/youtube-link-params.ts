import { stripQueryParams } from "@/utils/url-params";

// -- Constants ----------------------------------------------------------------

const YOUTUBE_PARAM_NAMES = ["youtube", "videoId", "v"] as const;

// -- Params -------------------------------------------------------------------

function readYouTubeParam(params: URLSearchParams): string | null {
  for (const name of YOUTUBE_PARAM_NAMES) {
    const value = params.get(name);
    if (value) return value;
  }
  return null;
}

function stripYouTubeParams(): void {
  stripQueryParams(YOUTUBE_PARAM_NAMES);
}

// -- Exports ------------------------------------------------------------------

export { readYouTubeParam, stripYouTubeParams };
