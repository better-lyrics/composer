import type { WordTiming } from "@/domain/word/timing";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { lcsPairs, wordKey } from "@/utils/word-diff";
import { synthesizeBracketedWord } from "@/utils/word-timing";

// -- Helpers ------------------------------------------------------------------

function tokenizeWordTexts(text: string): string[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
  return parts.map((part, i) => part + (trailingSpace[i] ? " " : ""));
}

function spreadEvenly(texts: string[], begin: number, end: number, bases: Array<WordTiming | undefined>) {
  const step = (end - begin) / texts.length;
  return texts.map((text, k) => ({ text, begin: begin + step * k, end: begin + step * (k + 1), base: bases[k] }));
}

function gluedToRightBracket(spread: Array<{ text: string; base: WordTiming | undefined }>): boolean[] {
  const glued = new Array<boolean>(spread.length);
  let chainOpen = true;
  for (let k = spread.length - 1; k >= 0; k--) {
    chainOpen = spread[k].base !== undefined || (chainOpen && !spread[k].text.endsWith(" "));
    glued[k] = chainOpen;
  }
  return glued;
}

// -- Functions ----------------------------------------------------------------

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

    let runStart = i;
    let runTexts = texts.slice(i, runEnd);
    let bases: Array<WordTiming | undefined> = runTexts.map(() => undefined);
    let slotBegin: number;
    let slotEnd: number;

    if (prevOld + 1 < nextOld) {
      slotBegin = oldWords[prevOld + 1].begin;
      slotEnd = oldWords[nextOld - 1].end;
    } else {
      slotBegin = leftBracket ? leftBracket.end : rightBracket.begin;
      slotEnd = rightBracket ? rightBracket.begin : slotBegin;
      // An insert with no gap to fill shares its neighbour's slot so it stays visible.
      if (slotEnd <= slotBegin && leftBracket) {
        const absorbed = result.pop() as WordTiming;
        runStart--;
        runTexts = [absorbed.text, ...runTexts];
        bases = [absorbed, ...bases];
        slotBegin = absorbed.begin;
        slotEnd = absorbed.end;
      } else if (slotEnd <= slotBegin) {
        runTexts = [...runTexts, texts[runEnd]];
        bases = [...bases, rightBracket];
        slotBegin = rightBracket.begin;
        slotEnd = rightBracket.end;
        runEnd++;
      }
    }

    const spread = spreadEvenly(runTexts, slotBegin, slotEnd, bases);
    const gluedToRight = gluedToRightBracket(spread);
    let gluedToLeft = runStart > 0 && !texts[runStart - 1].endsWith(" ");
    for (const [k, { text, begin, end, base }] of spread.entries()) {
      result.push(
        base
          ? { ...base, text, begin, end }
          : synthesizeBracketedWord({
              text,
              begin,
              end,
              leftBracket: gluedToLeft ? leftBracket : undefined,
              rightBracket: gluedToRight[k] ? rightBracket : undefined,
              explicit: false,
            }),
      );
      gluedToLeft = (base !== undefined || gluedToLeft) && !text.endsWith(" ");
    }
    i = runEnd;
  }

  return result;
}

// -- Exports ------------------------------------------------------------------

export { remapWordTextsPreservingTiming };
