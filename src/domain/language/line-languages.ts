import type { LineLanguage, LineLanguages, LineTranslations } from "@/domain/language/model";
import { withHeldReadingsPlaced } from "@/domain/language/side-pieces";
import type { LyricLine } from "@/domain/line/model";

// -- Reads --------------------------------------------------------------------

function lineTransliteration(line: Pick<LyricLine, "languages">): LineLanguage | undefined {
  return line.languages?.transliteration;
}

function lineTranslations(line: Pick<LyricLine, "languages">): LineTranslations | undefined {
  return line.languages?.translations;
}

// -- Writes -------------------------------------------------------------------

// A kind set to undefined is removed; a line with no kind left holds no languages.
function languagesWith(languages: LineLanguages | undefined, patch: Partial<LineLanguages>): LineLanguages | undefined {
  const next: LineLanguages = { ...languages, ...patch };
  if (next.translations === undefined) delete next.translations;
  if (next.transliteration === undefined) delete next.transliteration;
  if (next.heldReadings === undefined) delete next.heldReadings;
  return Object.keys(next).length ? withHeldReadingsPlaced(next) : undefined;
}

function withLanguages(
  line: Pick<LyricLine, "languages">,
  patch: Partial<LineLanguages>,
): { languages: LineLanguages | undefined } {
  return { languages: languagesWith(line.languages, patch) };
}

// Removing a romanization takes every syllable reading with it, as clearing its text always did.
function withoutTransliteration(line: Pick<LyricLine, "languages">): { languages: LineLanguages | undefined } {
  if (!lineTransliteration(line)) return { languages: line.languages };
  return withLanguages(line, { transliteration: undefined, heldReadings: undefined });
}

// -- Exports ------------------------------------------------------------------

export { languagesWith, lineTranslations, lineTransliteration, withLanguages, withoutTransliteration };
