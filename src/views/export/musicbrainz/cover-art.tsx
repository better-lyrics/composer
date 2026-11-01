import { cn } from "@/utils/cn";
import { releaseGroupCoverUrl } from "@/views/export/musicbrainz/musicbrainz-links";
import { useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface CoverArtProps {
  releaseGroupId: string | null;
  className?: string;
}

// -- Component ----------------------------------------------------------------

const CoverArt: React.FC<CoverArtProps> = ({ releaseGroupId, className }) => {
  const [failed, setFailed] = useState(false);
  if (!releaseGroupId || failed) return null;
  return (
    <img
      src={releaseGroupCoverUrl(releaseGroupId)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 rounded object-cover outline outline-1 -outline-offset-1 outline-white/10 select-none",
        className,
      )}
    />
  );
};

// -- Exports ------------------------------------------------------------------

export { CoverArt };
