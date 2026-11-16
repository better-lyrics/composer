import { splitTrailingWhitespace } from "./from-words";
import { lcsPairs, wordKey } from "./word-alignment";
import type { WordTiming } from "./word-timing";
import { splitIntoWordsWithMeta } from "./lyric-words";
import { msFromSeconds } from "./time";
import { textSlots } from "./word-letter-slots";
import { synthesizeBracketedWord } from "./word-clone";

// -- Helpers ------------------------------------------------------------------

function tokenizeWordTexts(text: string, splitChar: string): string[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text, splitChar);
  return parts.map((part, i) => part + (trailingSpace[i] ? " " : ""));
}

// A boundary the edit left alone keeps its join (a word can end without a space); elsewhere the typed
// text decides: a part runs into the next one unless a space ends it.
function joinedToTypedText(
  words: WordTiming[],
  texts: readonly string[],
  oldWords: readonly WordTiming[],
  oldIndexOf: readonly (number | undefined)[],
): WordTiming[] {
  return words.map((word, i) => {
    const old = oldIndexOf[i];
    const untouched = old !== undefined && oldIndexOf[i + 1] === old + 1 && oldWords[old].sep === word.sep;
    if (untouched) return word;
    return { ...word, joinsNext: i < texts.length - 1 && !texts[i].endsWith(" ") };
  });
}

function spreadEvenly(texts: string[], begin: number, end: number) {
  const step = (end - begin) / texts.length;
  return texts.map((text, k) => ({ text, begin: begin + step * k, end: begin + step * (k + 1) }));
}

// The fewest kept words next to a typed run whose time, with the run's slot, gives every word a millisecond: first the
// words after it, then the words before it. Slots by text index; null when no kept words around it make room.
function sharedSlots(
  texts: readonly string[],
  oldIndexOf: readonly (number | undefined)[],
  oldWords: readonly WordTiming[],
  slot: { begin: number; end: number },
  runStart: number,
  runEnd: number,
): Map<number, { begin: number; end: number }> | null {
  let from = runStart;
  let to = runEnd;
  const kept = (index: number) => oldIndexOf[index] !== undefined;
  const beginAt = (index: number) => (index === runStart ? slot.begin : oldWords[oldIndexOf[index] as number].begin);
  const endAt = (index: number) => (index === runEnd - 1 ? slot.end : oldWords[oldIndexOf[index] as number].end);
  while (to < texts.length && kept(to)) {
    to++;
    const slots = textSlots(texts.slice(from, to), beginAt(from), endAt(to - 1));
    if (slots) return new Map(slots.map((shared, index) => [from + index, shared]));
  }
  while (from > 0 && kept(from - 1)) {
    from--;
    const slots = textSlots(texts.slice(from, to), beginAt(from), endAt(to - 1));
    if (slots) return new Map(slots.map((shared, index) => [from + index, shared]));
  }
  return null;
}

// -- Functions ----------------------------------------------------------------

function insertSlot(prevEnd: number, nextBegin: number): { begin: number; end: number } {
  return { begin: prevEnd, end: Math.max(prevEnd, nextBegin) };
}

function remapWordTextsPreservingTiming(oldWords: WordTiming[], newText: string, splitChar: string): WordTiming[] {
  const texts = tokenizeWordTexts(newText, splitChar);
  const pairs = lcsPairs(
    oldWords.map((w) => wordKey(w.text, splitChar)),
    texts.map((value) => wordKey(value, splitChar)),
  );
  // Same count with every kept word in its place is a rename; a word that moved means words merged and others came.
  if (texts.length === oldWords.length && pairs.every(([oldIdx, newIdx]) => oldIdx === newIdx)) {
    const remapped = oldWords.map((oldWord, i) => ({ ...oldWord, ...splitTrailingWhitespace(texts[i]) }));
    return joinedToTypedText(
      remapped,
      texts,
      oldWords,
      oldWords.map((_, i) => i),
    );
  }

  const oldIndexOf: Array<number | undefined> = new Array(texts.length);
  for (const [oldIdx, newIdx] of pairs) oldIndexOf[newIdx] = oldIdx;

  const result: WordTiming[] = [];
  const retimed = new Map<number, { begin: number; end: number }>();
  let i = 0;
  while (i < texts.length) {
    const matched = oldIndexOf[i];
    if (matched !== undefined) {
      result.push({ ...oldWords[matched], ...splitTrailingWhitespace(texts[i]) });
      i++;
      continue;
    }

    let runEnd = i;
    while (runEnd < texts.length && oldIndexOf[runEnd] === undefined) runEnd++;
    const prevOld = i > 0 ? (oldIndexOf[i - 1] as number) : -1;
    const nextOld = runEnd < texts.length ? (oldIndexOf[runEnd] as number) : oldWords.length;
    const leftBracket = oldWords[prevOld];
    const rightBracket = oldWords[nextOld];

    const runTexts = texts.slice(i, runEnd);
    let slot: { begin: number; end: number };
    if (prevOld + 1 < nextOld) {
      slot = { begin: oldWords[prevOld + 1].begin, end: oldWords[nextOld - 1].end };
    } else {
      const prevEnd = leftBracket ? leftBracket.end : rightBracket.begin;
      slot = insertSlot(prevEnd, rightBracket ? rightBracket.begin : prevEnd);
    }
    // With under a millisecond each, the typed words share the time of the kept words around them by letters, as a
    // typed split does; a run after every kept word stays for the untimed tail.
    const roomMs = msFromSeconds(slot.end) - msFromSeconds(slot.begin);
    if (roomMs < runTexts.length && rightBracket) {
      for (const [index, shared] of sharedSlots(texts, oldIndexOf, oldWords, slot, i, runEnd) ?? [])
        retimed.set(index, shared);
    }

    for (const { text, begin, end } of spreadEvenly(runTexts, slot.begin, slot.end)) {
      result.push(
        synthesizeBracketedWord({ ...splitTrailingWhitespace(text), begin, end, joinsNext: false, explicit: false }),
      );
    }
    i = runEnd;
  }

  const shared = result.map((word, index) => {
    const slot = retimed.get(index);
    return slot ? { ...word, ...slot } : word;
  });
  return joinedToTypedText(shared, texts, oldWords, oldIndexOf);
}

// -- Exports ------------------------------------------------------------------

export { insertSlot, remapWordTextsPreservingTiming };
