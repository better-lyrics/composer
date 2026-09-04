import { languageSourceText } from "@/domain/language/source-text";
import type { LyricLine } from "@/domain/line/model";
import type { LanguageLineInput } from "@/services/language-provider";

function languageGenerationInputs(lines: LyricLine[]) {
  const mainInputs: LanguageLineInput[] = [];
  const bgInputs: LanguageLineInput[] = [];
  for (const line of lines) {
    const text = languageSourceText(line.text);
    const backgroundText = line.backgroundText ? languageSourceText(line.backgroundText) : undefined;
    if (text) mainInputs.push({ id: line.id, text });
    if (backgroundText) bgInputs.push({ id: line.id, text: backgroundText });
  }
  return { mainInputs, bgInputs };
}

export { languageGenerationInputs };
