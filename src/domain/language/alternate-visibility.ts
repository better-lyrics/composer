import { withoutSplitCharacter } from "@/utils/split-character-text";

function comparableLyricText(text: string, splitChar: string): string {
  return withoutSplitCharacter(text, splitChar).toLocaleLowerCase().replace(/\p{P}/gu, "").replace(/\s+/g, " ").trim();
}

function alternateMatchesMainText(alternate: string | undefined, main: string, splitChar: string): boolean {
  return alternate !== undefined && comparableLyricText(alternate, splitChar) === comparableLyricText(main, splitChar);
}

export { alternateMatchesMainText, comparableLyricText };
