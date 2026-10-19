import type { LyricLine } from "@/domain/line/model";
import { googleLanguageProvider } from "@/services/google-language-provider";
import type { TranslationGeneration, TransliterationGeneration } from "@/views/languages/generated-language-updates";
import { languageGenerationInputs } from "@/views/languages/generation-inputs";

// -- Interfaces ---------------------------------------------------------------

interface LanguageGenerationRequest {
  translations: readonly string[];
  transliteration: boolean;
  sourceLanguage: string;
  signal: AbortSignal;
}

interface LanguageGenerationResult {
  transliteration?: TransliterationGeneration;
  translations: TranslationGeneration[];
  failedLineIds: ReadonlySet<string>;
  detectedLanguage?: string;
}

// -- Functions ----------------------------------------------------------------

async function requestLanguageGeneration(
  lines: readonly LyricLine[],
  { translations, transliteration, sourceLanguage, signal }: LanguageGenerationRequest,
): Promise<LanguageGenerationResult> {
  const { mainInputs, bgInputs } = languageGenerationInputs(lines);
  const [romanizationResults, translationResults] = await Promise.all([
    transliteration
      ? Promise.all([
          googleLanguageProvider.transliterate(mainInputs, sourceLanguage, signal),
          googleLanguageProvider.transliterate(bgInputs, sourceLanguage, signal),
        ])
      : Promise.resolve(null),
    Promise.all(
      translations.flatMap((language) => [
        googleLanguageProvider.translate(mainInputs, language, sourceLanguage, signal),
        googleLanguageProvider.translate(bgInputs, language, sourceLanguage, signal),
      ]),
    ),
  ]);
  const [romanMain, romanBg] = romanizationResults ?? [];
  return {
    transliteration: romanMain
      ? {
          language: romanMain.language,
          backgroundLanguage: romanBg?.language,
          main: new Map(romanMain.lines.map((result) => [result.id, result])),
          background: new Map(romanBg?.lines.map((result) => [result.id, result]) ?? []),
        }
      : undefined,
    translations: translations.map((language, index) => ({
      language,
      main: new Map(translationResults[index * 2].lines.map((result) => [result.id, result])),
      background: new Map(translationResults[index * 2 + 1].lines.map((result) => [result.id, result])),
    })),
    failedLineIds: new Set(
      [...(romanizationResults ?? []), ...translationResults].flatMap((batch) =>
        batch.lines.flatMap((result) => (result.failed ? [result.id] : [])),
      ),
    ),
    detectedLanguage: romanMain?.detectedLanguage || translationResults[0]?.detectedLanguage,
  };
}

// -- Exports ------------------------------------------------------------------

export { requestLanguageGeneration };
export type { LanguageGenerationResult };
