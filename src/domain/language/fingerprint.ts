import { fnv1a } from "insync/fnv1a";
import { withoutSplitCharacter } from "insync/split-character-text";

function languageSourceFingerprint(splitChar: string, text: string, backgroundText?: string): string {
  const value = `${withoutSplitCharacter(text, splitChar)}\u0000${backgroundText ? withoutSplitCharacter(backgroundText, splitChar) : ""}`;
  return fnv1a(value).toString(36);
}

export { languageSourceFingerprint };
