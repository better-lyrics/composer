import type { WordTiming } from "./word-timing";

// -- Functions ----------------------------------------------------------------

// Word timings are chronological: each word begins at or after the previous one
// ends, and no word ends before it begins. Re-recording a word in place can push
// it past its neighbours in either direction, so the words around the edited one
// are squeezed to the nearest times that restore the order. A later word that
// would be squeezed to zero length keeps its length and moves after the edited
// one instead; words never get dropped, so `words` keeps the line's length.
function enforceOrderAround(words: WordTiming[], index: number, songEnd = Number.POSITIVE_INFINITY): WordTiming[] {
  const anchor = words[index];
  if (!anchor) return words;

  let result = words;
  const copyOnWrite = () => {
    if (result === words) result = [...words];
  };

  let nextBegin = anchor.begin;
  for (let i = index - 1; i >= 0; i--) {
    const word = result[i];
    if (word.end <= nextBegin && word.begin <= word.end) break;
    const end = Math.min(word.end, nextBegin);
    const begin = Math.min(word.begin, end);
    copyOnWrite();
    result[i] = { ...word, begin, end };
    nextBegin = begin;
  }

  let previousEnd = anchor.end;
  for (let i = index + 1; i < words.length; i++) {
    const word = result[i];
    if (word.begin >= previousEnd && word.end >= word.begin) break;
    const begin = Math.max(word.begin, previousEnd);
    const length = word.end - word.begin;
    const end =
      word.end > begin || length <= 0 ? Math.max(word.end, begin) : Math.max(begin, Math.min(begin + length, songEnd));
    copyOnWrite();
    result[i] = { ...word, begin, end };
    previousEnd = end;
  }

  return result;
}

// -- Exports ------------------------------------------------------------------

export { enforceOrderAround };
