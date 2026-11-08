import { createContext, useContext } from "react";
import { useUnisonFeatures } from "@/hooks/unison/useUnisonFeatures";
import { artworkUrl } from "@/lib/unison/endpoints";

// -- Types ---------------------------------------------------------------------

interface ArtSource {
  thumbnailDataUrl?: string;
  videoId?: string;
  unisonLyricId?: string;
}

// -- Context -------------------------------------------------------------------

// The video of each linked lyric, by lyric id, from the account's lyrics a screen already loaded.
const LinkedLyricVideos = createContext<ReadonlyMap<string, string>>(new Map());

// -- Hook ----------------------------------------------------------------------

// A project's own cover wins. Without one, Unison serves the cover of its video, or of its linked lyric's video.
function useProjectArtSrc({ thumbnailDataUrl, videoId, unisonLyricId }: ArtSource): string | undefined {
  const { enabled } = useUnisonFeatures();
  const linkedVideos = useContext(LinkedLyricVideos);
  if (thumbnailDataUrl || !enabled) return thumbnailDataUrl;
  const shownVideoId = videoId ?? (unisonLyricId ? linkedVideos.get(unisonLyricId) : undefined);
  return shownVideoId ? artworkUrl(shownVideoId) : undefined;
}

// -- Exports -------------------------------------------------------------------

export { LinkedLyricVideos, useProjectArtSrc };
