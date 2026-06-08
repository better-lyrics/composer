// -- Types --------------------------------------------------------------------

interface ProjectMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  language?: string;
  thumbnailDataUrl?: string;
}

// -- Exports ------------------------------------------------------------------

export type { ProjectMetadata };
