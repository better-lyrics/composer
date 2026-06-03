// -- Types --------------------------------------------------------------------

type TimelinePrimaryWordText = "source" | "romaji";

interface ProjectMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  language?: string;
  romanizationScheme?: string;
  timelinePrimaryWordText?: TimelinePrimaryWordText;
}

// -- Exports ------------------------------------------------------------------

export type { ProjectMetadata, TimelinePrimaryWordText };
