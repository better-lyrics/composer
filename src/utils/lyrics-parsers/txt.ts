import { readGeniusLyrics, readsAsGeniusLyrics } from "@/domain/lyrics-file/genius-text";
import { type ParseResult, generateLineId } from "@/utils/lyrics-parsers/shared";
import { cleanSplitCharacters, getSplitCharacter } from "@/utils/split-character";

// -- Helpers ------------------------------------------------------------------

function plainTextLines(content: string): { text: string; agentId: string }[] {
  const texts = content.split(/\r?\n/).map((raw) => raw.trim());
  const first = texts.findIndex((text) => text.length > 0);
  const last = texts.findLastIndex((text) => text.length > 0);
  return (first === -1 ? [] : texts.slice(first, last + 1)).map((text) => ({ text, agentId: "v1" }));
}

// -- Plain Text Parser --------------------------------------------------------

function parseTxt(content: string, _fallbackDuration?: number): ParseResult {
  const splitChar = getSplitCharacter();
  const genius = readsAsGeniusLyrics(content) ? readGeniusLyrics(content) : null;
  const lines = (genius?.lines ?? plainTextLines(content)).map(({ text, agentId }) => ({
    id: generateLineId(),
    text: text.includes(splitChar) ? cleanSplitCharacters(text) : text,
    agentId,
  }));

  return {
    lines,
    metadata: {},
    hasTimingData: false,
    issues: [],
    agents: genius?.agents,
  };
}

// -- Exports ------------------------------------------------------------------

export { parseTxt };
