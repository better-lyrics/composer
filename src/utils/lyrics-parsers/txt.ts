import { cleanSplitCharacters, getSplitCharacter } from "@/utils/split-character";
import { generateLineId, type ParseResult } from "@/utils/lyrics-parsers/shared";

// -- Plain Text Parser --------------------------------------------------------

function parseTxt(content: string, _fallbackDuration?: number): ParseResult {
  const splitChar = getSplitCharacter();
  const texts = content.split(/\r?\n/).map((raw) => raw.trim());
  const first = texts.findIndex((text) => text.length > 0);
  const last = texts.findLastIndex((text) => text.length > 0);
  const lines = (first === -1 ? [] : texts.slice(first, last + 1)).map((text) => ({
    id: generateLineId(),
    text: text.includes(splitChar) ? cleanSplitCharacters(text) : text,
    agentId: "v1",
  }));

  return {
    lines,
    metadata: {},
    hasTimingData: false,
    issues: [],
  };
}

// -- Exports ------------------------------------------------------------------

export { parseTxt };
