// -- Types --------------------------------------------------------------------

interface LinkGroup {
  id: string;
  label: string;
  color: string;
  templateVersion: number;
}

interface WordTemplate {
  text: string;
  relativeBegin: number;
  relativeEnd: number;
  explicit?: true;
  transliteration?: string;
}

interface LineTemplate {
  text: string;
  agentId: string;
  relativeBegin?: number;
  relativeEnd?: number;
  words?: WordTemplate[];
  backgroundText?: string;
  backgroundWords?: WordTemplate[];
  backgroundTextSource?: "extraction" | "manual";
  translations?: import("@/domain/language/model").TranslationTracks;
  transliteration?: import("@/domain/language/model").TransliterationTrack;
}

// -- Exports ------------------------------------------------------------------

export type { LinkGroup, WordTemplate, LineTemplate };
