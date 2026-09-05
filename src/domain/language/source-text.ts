import { stripSplitCharacter } from "@/utils/split-character";

function languageSourceText(text: string): string {
  return stripSplitCharacter(text).trim();
}

export { languageSourceText };
