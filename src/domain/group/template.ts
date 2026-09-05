import type { WordTiming } from "@/domain/word/timing";

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
  transliterationJoinerAfter?: string;
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

// Keep exact alternate fragments and separators when moving between absolute
// timings and templates; an empty string is meaningful for both fields.
function wordsToTemplate(words: WordTiming[], instanceStart: number): WordTemplate[] {
  return words.map(({ begin, end, syllableGroupId: _groupId, ...word }) => ({
    ...word,
    relativeBegin: begin - instanceStart,
    relativeEnd: end - instanceStart,
  }));
}

function offsetTemplateWords(words: WordTemplate[], instanceStart: number): WordTiming[] {
  return words.map(({ relativeBegin, relativeEnd, ...word }) => ({
    ...word,
    begin: relativeBegin + instanceStart,
    end: relativeEnd + instanceStart,
  }));
}

// -- Exports ------------------------------------------------------------------

export { wordsToTemplate, offsetTemplateWords };
export type { LinkGroup, WordTemplate, LineTemplate };
