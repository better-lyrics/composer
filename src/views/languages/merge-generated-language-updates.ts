import { lineTranslations } from "insync/language-line-languages";
import type { LyricLine } from "insync/line";
import { backgroundText, lineText } from "insync/line-text";
import { generatedLanguageUpdates } from "@/views/languages/generated-language-updates";
import type { GenerationEdits } from "@/views/languages/generation-edit-guard";
import { sameTransliteration } from "@/views/languages/same-transliteration";
import { getSplitCharacter } from "@/utils/split-character";

function mergeGeneratedLanguageUpdates(
  startingLines: ReadonlyMap<string, LyricLine>,
  currentLines: LyricLine[],
  targets: readonly string[],
  options: Parameters<typeof generatedLanguageUpdates>[1],
  edits: GenerationEdits,
): Array<{ id: string; updates: Partial<LyricLine> }> {
  const targetLanguages = new Set(targets);
  return currentLines.flatMap((line) => {
    const original = startingLines.get(line.id);
    // Results belong to the submitted source. Do not stamp old results with the
    // fingerprint of text edited while the provider was running.
    if (
      !original ||
      lineText(original, getSplitCharacter()) !== lineText(line, getSplitCharacter()) ||
      backgroundText(original, getSplitCharacter()) !== backgroundText(line, getSplitCharacter())
    )
      return [];
    const updates = generatedLanguageUpdates(line, {
      force: options.force,
      // Force replaces edits present at request start, but edits made during
      // that request take precedence. Track identity also catches removals.
      transliteration:
        !edits.transliteration.has(line.id) && sameTransliteration(original, line)
          ? options.transliteration
          : undefined,
      translations: options.translations.filter(
        ({ language }) =>
          targetLanguages.has(language) &&
          !edits.translations.get(line.id)?.has(language) &&
          lineTranslations(original)?.[language] === lineTranslations(line)?.[language],
      ),
    });
    return Object.keys(updates).length > 0 ? [{ id: line.id, updates }] : [];
  });
}

export { mergeGeneratedLanguageUpdates };
