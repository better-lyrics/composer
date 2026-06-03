import type { LyricLine } from "@/domain/line/model";
import { generateForLine } from "@/utils/romanization/generate-for-line";
import { stripSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface RegenerateWordResult {
  text: string;
  romaji: string;
}

// -- Public API ---------------------------------------------------------------

async function regenerateWord(line: LyricLine, wordIndex: number, scheme: string): Promise<RegenerateWordResult> {
  if (!line.words || !line.words[wordIndex]) {
    throw new Error(`regenerateWord: line ${line.id} has no word at index ${wordIndex}`);
  }
  const sourceWord = stripSplitCharacter(line.words[wordIndex].text);
  const sliceLine: LyricLine = {
    ...line,
    text: sourceWord,
    words: [{ ...line.words[wordIndex], text: sourceWord }],
    romanization: undefined,
  };
  const result = await generateForLine(sliceLine, scheme);
  return {
    text: sourceWord,
    romaji: (result.wordTexts?.[0] ?? result.text).trim(),
  };
}

// -- Exports ------------------------------------------------------------------

export { regenerateWord };
export type { RegenerateWordResult };
