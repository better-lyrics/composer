import { languageSourceText } from "@/domain/language/source-text";
import type { LyricLine } from "insync/line";
import { backgroundText, lineText } from "insync/line-text";
import type { LanguageLineInput } from "@/services/language-provider";
import { getSplitCharacter } from "@/utils/split-character";

function languageGenerationInputs(lines: readonly LyricLine[]) {
  const mainInputs: LanguageLineInput[] = [];
  const bgInputs: LanguageLineInput[] = [];
  for (const line of lines) {
    const text = languageSourceText(lineText(line, getSplitCharacter()), getSplitCharacter());
    const bgText = backgroundText(line, getSplitCharacter());
    const bgSource = bgText ? languageSourceText(bgText, getSplitCharacter()) : undefined;
    if (text) mainInputs.push({ id: line.id, text });
    if (bgSource) bgInputs.push({ id: line.id, text: bgSource });
  }
  return { mainInputs, bgInputs };
}

export { languageGenerationInputs };
