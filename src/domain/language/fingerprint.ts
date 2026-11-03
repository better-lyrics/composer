import { stripSplitCharacter } from "@/utils/split-character";
import { textHash } from "@/utils/text-hash";

function languageSourceFingerprint(text: string, backgroundText?: string): string {
  return textHash(`${stripSplitCharacter(text)}\u0000${backgroundText ? stripSplitCharacter(backgroundText) : ""}`);
}

export { languageSourceFingerprint };
