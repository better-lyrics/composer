import { drawnSyllables } from "insync/line-drawn-track";
import type { LyricLine } from "insync/line";
import { trackRole, type WordTrack } from "insync/line-track";
import type { SyllableAddress } from "insync/selection-model";
import { addressOf } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Functions ----------------------------------------------------------------

// A slot with no word yet gets an address that resolves to nothing, as a selection of a removed word would.
function wordAddress(line: LyricLine, wordIndex: number, type: WordTrack = "word"): SyllableAddress {
  const word = drawnSyllables(line, trackRole(type), DEFAULT_SPLIT_CHARACTER)[wordIndex];
  return word
    ? addressOf(line, type, word)
    : { lineId: line.id, type, syllableId: `${line.id}-${type}-${wordIndex}-none` };
}

// The word at an index of a line in the project store, named the way a selection names it.
function storedWordAddress(lineId: string, wordIndex: number, type: WordTrack = "word"): SyllableAddress {
  const line = useProjectStore.getState().lines.find((candidate) => candidate.id === lineId);
  if (!line) throw new Error(`No line ${lineId} in the project`);
  return wordAddress(line, wordIndex, type);
}

// -- Exports ------------------------------------------------------------------

export { storedWordAddress, wordAddress };
