import { splitTrailingWhitespace } from "insync/from-words";
import type { LyricLine } from "@/domain/line/model";
import { newWordId } from "@/domain/word/id";
import type { WordTiming } from "@/domain/word/timing";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// -- Types --------------------------------------------------------------------

interface SlotWord {
  text: string;
  joinsNext: boolean;
}

// -- Functions ----------------------------------------------------------------

// The line text decides a new slot's join: a part runs into the next one unless a space ends it.
function slotWords(line: LyricLine): SlotWord[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(line.text);
  return parts.map((part, index) => ({
    text: trailingSpace[index] ? `${part} ` : part,
    joinsNext: !trailingSpace[index] && index < parts.length - 1,
  }));
}

// A save drops a trailing join, so appending a slot also restores the join of the word before it.
function withSlotWord(
  existing: readonly WordTiming[],
  slots: readonly SlotWord[],
  index: number,
  timing: { begin: number; end: number },
): WordTiming[] {
  const words = [...existing];
  const written = existing.at(index) ?? { id: newWordId(), joinsNext: slots[index].joinsNext };
  words[index] = { ...written, ...splitTrailingWhitespace(slots[index].text), ...timing };
  const previous = index === existing.length ? existing.at(-1) : undefined;
  const previousSlot = slots[index - 1];
  if (previous && previousSlot) words[index - 1] = { ...previous, joinsNext: previousSlot.joinsNext };
  return words;
}

// -- Exports ------------------------------------------------------------------

export { slotWords, withSlotWord };
