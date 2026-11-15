import { withoutSplitCharacter } from "insync/split-character-text";

function languageSourceText(text: string, splitChar: string): string {
  return withoutSplitCharacter(text, splitChar).trim();
}

export { languageSourceText };
