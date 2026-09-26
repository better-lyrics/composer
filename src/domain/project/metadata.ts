// -- Types --------------------------------------------------------------------

interface ProjectMetadata {
  title: string;
  artists: string[];
  album: string;
  duration: number;
  isrc?: string;
  songwriters?: string[];
  extra?: Record<string, string>;
  language?: string;
  thumbnailDataUrl?: string;
  thumbnailForVideoId?: string;
}

// -- Exports ------------------------------------------------------------------

export type { ProjectMetadata };
