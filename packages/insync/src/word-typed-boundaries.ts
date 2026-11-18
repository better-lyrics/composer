import { newWordId } from "./word-id";
import { letterSlots } from "./word-letter-slots";
import { textParts } from "./word-text-parts";
import type { WordTiming } from "./word-timing";

// -- Functions ----------------------------------------------------------------

// A syllable's text holds no space and no split mark, so it reads back as Edit shows it: one typed or split into a
// syllable becomes a boundary there, and the syllable's time is shared by its letters.
function withTypedBoundaries(words: readonly WordTiming[], splitChar: string): WordTiming[] {
  const bounded: WordTiming[] = [];
  for (const word of words) {
    const parts = textParts(word.text, splitChar);
    if (parts.length === 0 || (parts.length === 1 && parts[0].text === word.text)) {
      bounded.push(word);
      continue;
    }
    const previous = bounded.at(-1);
    if (previous && word.text.trimStart() !== word.text)
      bounded[bounded.length - 1] = { ...previous, sep: previous.sep || " ", joinsNext: false };
    const slots = letterSlots(
      parts.map((part) => part.text.length),
      word.begin,
      word.end,
    );
    parts.forEach((part, index) => {
      const last = index === parts.length - 1;
      bounded.push({
        ...word,
        id: index === 0 ? word.id : newWordId(),
        text: part.text,
        sep: last ? part.sep || word.sep : part.sep,
        joinsNext: last ? !part.sep && word.joinsNext : part.joinsNext,
        ...slots[index],
      });
    });
  }
  return bounded;
}

// -- Exports ------------------------------------------------------------------

export { withTypedBoundaries };
