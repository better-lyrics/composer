import { languageSourceText } from "@/domain/language/source-text";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import type { LanguageLineInput } from "@/services/language-provider";

function languageGenerationInputs(lines: readonly LyricLine[]) {
  const mainInputs: LanguageLineInput[] = [];
  const bgInputs: LanguageLineInput[] = [];
  for (const line of lines) {
    const text = languageSourceText(lineText(line));
    const bgText = backgroundText(line);
    const bgSource = bgText ? languageSourceText(bgText) : undefined;
    if (text) mainInputs.push({ id: line.id, text });
    if (bgSource) bgInputs.push({ id: line.id, text: bgSource });
  }
  return { mainInputs, bgInputs };
}

export { languageGenerationInputs };
