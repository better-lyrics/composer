import type { WordTiming } from "@/domain/word/timing";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { lcsPairs, wordKey } from "@/domain/word/alignment";
import { synthesizeBracketedWord } from "@/utils/word-timing";

// -- Helpers ------------------------------------------------------------------

function tokenizeWordTexts(text: string): string[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
  return parts.map((part, i) => part + (trailingSpace[i] ? " " : ""));
}

function spreadEvenly(texts: string[], begin: number, end: number) {
  const step = (end - begin) / texts.length;
  return texts.map((text, k) => ({ text, begin: begin + step * k, end: begin + step * (k + 1) }));
}

function gluedToRightBracket(texts: string[]): boolean[] {
  const glued = new Array<boolean>(texts.length);
  let chainOpen = true;
  for (let k = texts.length - 1; k >= 0; k--) {
    chainOpen = chainOpen && !texts[k].endsWith(" ");
    glued[k] = chainOpen;
  }
  return glued;
}

// -- Functions ----------------------------------------------------------------

function insertSlot(prevEnd: number, nextBegin: number): { begin: number; end: number } {
  return { begin: prevEnd, end: Math.max(prevEnd, nextBegin) };
}

function remapWordTextsPreservingTiming(oldWords: WordTiming[], newText: string): WordTiming[] {
  const texts = tokenizeWordTexts(newText);
  if (texts.length === oldWords.length) {
    return oldWords.map((oldWord, i) => ({ ...oldWord, text: texts[i] }));
  }

  const oldIndexOf: Array<number | undefined> = new Array(texts.length);
  const pairs = lcsPairs(
    oldWords.map((w) => wordKey(w.text)),
    texts.map(wordKey),
  );
  for (const [oldIdx, newIdx] of pairs) oldIndexOf[newIdx] = oldIdx;

  const result: WordTiming[] = [];
  let i = 0;
  while (i < texts.length) {
    const matched = oldIndexOf[i];
    if (matched !== undefined) {
      result.push({ ...oldWords[matched], text: texts[i] });
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

    const gluedToRight = gluedToRightBracket(runTexts);
    let gluedToLeft = i > 0 && !texts[i - 1].endsWith(" ");
    for (const [k, { text, begin, end }] of spreadEvenly(runTexts, slot.begin, slot.end).entries()) {
      result.push(
        synthesizeBracketedWord({
          text,
          begin,
          end,
          leftBracket: gluedToLeft ? leftBracket : undefined,
          rightBracket: gluedToRight[k] ? rightBracket : undefined,
          explicit: false,
        }),
      );
      gluedToLeft = gluedToLeft && !text.endsWith(" ");
    }
    i = runEnd;
  }

  return result;
}

// -- Exports ------------------------------------------------------------------

export { insertSlot, remapWordTextsPreservingTiming };
