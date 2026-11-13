import type { LineLanguage, LineLanguages, LineTranslations } from "@/domain/language/model";
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
  return Object.keys(next).length ? next : undefined;
}

function withLanguages(
  line: Pick<LyricLine, "languages">,
  patch: Partial<LineLanguages>,
): { languages: LineLanguages | undefined } {
  return { languages: languagesWith(line.languages, patch) };
}

// -- Exports ------------------------------------------------------------------

export { languagesWith, lineTranslations, lineTransliteration, withLanguages };
