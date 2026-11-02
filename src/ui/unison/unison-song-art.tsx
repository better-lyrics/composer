import { ProjectArt } from "@/ui/projects/project-art";
import { YOUTUBE_PLACEHOLDER_THUMBNAIL_WIDTH, youTubeThumbnailUrl } from "@/utils/youtube-music-url";

// -- Types ---------------------------------------------------------------------

interface UnisonSongArtProps {
  videoId: string;
  artworkUrl?: string | null;
  size: "row" | "dialog";
}

// -- Component -----------------------------------------------------------------

const UnisonSongArt: React.FC<UnisonSongArtProps> = ({ videoId, artworkUrl, size }) =>
  artworkUrl ? (
    <ProjectArt src={artworkUrl} size={size} />
  ) : (
    <ProjectArt
      src={youTubeThumbnailUrl(videoId)}
      size={size}
      rejectNaturalWidth={YOUTUBE_PLACEHOLDER_THUMBNAIL_WIDTH}
    />
  );

// -- Exports -------------------------------------------------------------------

export { UnisonSongArt };
