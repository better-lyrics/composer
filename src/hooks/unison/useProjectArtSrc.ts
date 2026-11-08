import { useUnisonFeatures } from "@/hooks/unison/useUnisonFeatures";
import { artworkUrl } from "@/lib/unison/endpoints";

// -- Types ---------------------------------------------------------------------

interface ArtSource {
  thumbnailDataUrl?: string;
  videoId?: string;
}

// -- Hook ----------------------------------------------------------------------

// A project's own cover wins. Without one, a YouTube project shows the cover Unison serves for its video.
function useProjectArtSrc({ thumbnailDataUrl, videoId }: ArtSource): string | undefined {
  const { enabled } = useUnisonFeatures();
  if (thumbnailDataUrl) return thumbnailDataUrl;
  return enabled && videoId ? artworkUrl(videoId) : undefined;
}

// -- Exports -------------------------------------------------------------------

export { useProjectArtSrc };
