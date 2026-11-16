import { splitTrailingWhitespace } from "./from-words";
import { splitIntoWordsWithMeta } from "./lyric-words";
import { lcsPairs, wordKey } from "./word-alignment";
import { synthesizeBracketedWord } from "./word-clone";
import { letterSlots } from "./word-letter-slots";
import type { WordTiming } from "./word-timing";

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

// -- Functions ----------------------------------------------------------------

function insertSlot(prevEnd: number, nextBegin: number): { begin: number; end: number } {
  return { begin: prevEnd, end: Math.max(prevEnd, nextBegin) };
}

function remapWordTextsPreservingTiming(oldWords: WordTiming[], newText: string, splitChar: string): WordTiming[] {
  const texts = tokenizeWordTexts(newText, splitChar);
  if (texts.length === oldWords.length) {
    const remapped = oldWords.map((oldWord, i) => ({ ...oldWord, ...splitTrailingWhitespace(texts[i]) }));
    return joinedToTypedText(
      remapped,
      texts,
      oldWords,
      oldWords.map((_, i) => i),
    );
  }

  const oldIndexOf: Array<number | undefined> = new Array(texts.length);
  const pairs = lcsPairs(
    oldWords.map((w) => wordKey(w.text, splitChar)),
    texts.map((value) => wordKey(value, splitChar)),
  );
  for (const [oldIdx, newIdx] of pairs) oldIndexOf[newIdx] = oldIdx;

  const result: WordTiming[] = [];
  let sharedBegin: number | undefined;
  let i = 0;
  while (i < texts.length) {
    const matched = oldIndexOf[i];
    if (matched !== undefined) {
      result.push({
        ...oldWords[matched],
        ...splitTrailingWhitespace(texts[i]),
        ...(sharedBegin !== undefined && { begin: sharedBegin }),
      });
      sharedBegin = undefined;
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
    let runSlots: { text: string; begin: number; end: number }[] | undefined;

    if (prevOld + 1 < nextOld) {
      slot = { begin: oldWords[prevOld + 1].begin, end: oldWords[nextOld - 1].end };
    } else {
      const prevEnd = leftBracket ? leftBracket.end : rightBracket.begin;
      slot = insertSlot(prevEnd, rightBracket ? rightBracket.begin : prevEnd);
      // With no room before the next word, the typed words share its slot by letters, the way a typed split does.
      if (slot.end === slot.begin && rightBracket && slot.begin < rightBracket.end) {
        const shared = [...runTexts, texts[runEnd]];
        const slots = letterSlots(
          shared.map((text) => Math.max(1, text.trim().length)),
          slot.begin,
          rightBracket.end,
        );
        runSlots = runTexts.map((text, index) => ({ text, ...slots[index] }));
        sharedBegin = slots[runTexts.length].begin;
      }
    }

    for (const { text, begin, end } of runSlots ?? spreadEvenly(runTexts, slot.begin, slot.end)) {
      result.push(
        synthesizeBracketedWord({ ...splitTrailingWhitespace(text), begin, end, joinsNext: false, explicit: false }),
      );
    }
    i = runEnd;
  }

  return joinedToTypedText(result, texts, oldWords, oldIndexOf);
}

// -- Exports ------------------------------------------------------------------

export { insertSlot, remapWordTextsPreservingTiming };
