import type { Ms } from "./time";

// -- Types --------------------------------------------------------------------

// Lines as saved format 4 spells them: integer ms, tracks of syllables, readings by syllable position.

type SavedSpan = [Ms, Ms];

interface SavedSyllable {
  id?: string;
  text: string;
  sep: string;
  joinsNext?: true;
  span?: SavedSpan;
  explicit?: true;
}

interface SavedTrack {
  id?: string;
  role: "main" | "bg";
  agent?: string;
  source?: "extraction" | "manual";
  span?: SavedSpan;
  syllables: SavedSyllable[];
}

interface SavedPiece {
  text?: string;
  joinerAfter?: string;
}

// Aligned with the track's syllables; null where a syllable has no reading.
type SavedPieces = (SavedPiece | null)[];

interface SavedSegment {
  original: string;
  transliteration: string;
}

type SavedAlignmentStatus = "confirmed" | "inferred" | "needs-review" | "unresolved";

interface SavedTrackLanguage {
  text?: string;
  segments?: SavedSegment[];
  pieces?: SavedPieces;
  alignmentStatus?: SavedAlignmentStatus;
  reviewedSourceFingerprint?: string;
}

interface SavedLineLanguage {
  language: string;
  // A template type: the insync boundary guard reads the quoted word import as an import statement.
  origin: "google" | `import` | "manual";
  sourceFingerprint: string;
  stale?: boolean;
  main: SavedTrackLanguage & { text: string };
  bg?: SavedTrackLanguage;
}

interface SavedLanguages {
  translations?: Record<string, SavedLineLanguage>;
  transliteration?: SavedLineLanguage;
  // Readings kept for a track whose line has no romanization on that side yet.
  heldReadings?: { main?: SavedPieces; bg?: SavedPieces };
}

interface SavedLine {
  id: string;
  tracks: SavedTrack[];
  languages?: SavedLanguages;
  groupId?: string;
  instanceIdx?: number;
  templateLineIdx?: number;
  detached?: boolean;
}

// -- Exports ------------------------------------------------------------------

export type {
  SavedLanguages,
  SavedLine,
  SavedLineLanguage,
  SavedPiece,
  SavedPieces,
  SavedSpan,
  SavedSyllable,
  SavedTrack,
  SavedTrackLanguage,
};
