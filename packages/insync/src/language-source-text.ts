import { withoutSplitCharacter } from "./split-character-text";

function languageSourceText(text: string, splitChar: string): string {
  return withoutSplitCharacter(text, splitChar).trim();
}

export { languageSourceText };
