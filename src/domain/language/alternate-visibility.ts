import { stripSplitCharacter } from "@/utils/split-character";

function comparableLyricText(text: string): string {
  return stripSplitCharacter(text).toLocaleLowerCase().replace(/\p{P}/gu, "").replace(/\s+/g, " ").trim();
}

function alternateMatchesMainText(alternate: string | undefined, main: string): boolean {
  return alternate !== undefined && comparableLyricText(alternate) === comparableLyricText(main);
}

export { alternateMatchesMainText, comparableLyricText };
