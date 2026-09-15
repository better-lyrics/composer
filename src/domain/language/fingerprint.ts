import { stripSplitCharacter } from "@/utils/split-character";

function languageSourceFingerprint(text: string, backgroundText?: string): string {
  const value = `${stripSplitCharacter(text)}\u0000${backgroundText ? stripSplitCharacter(backgroundText) : ""}`;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export { languageSourceFingerprint };
