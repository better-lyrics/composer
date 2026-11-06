import { fnv1a } from "@/utils/fnv1a";
import { stripSplitCharacter } from "@/utils/split-character";

function languageSourceFingerprint(text: string, backgroundText?: string): string {
  const value = `${stripSplitCharacter(text)}\u0000${backgroundText ? stripSplitCharacter(backgroundText) : ""}`;
  return fnv1a(value).toString(36);
}

export { languageSourceFingerprint };
