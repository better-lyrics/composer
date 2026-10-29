import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import { remapWordTextsPreservingTiming } from "@/domain/word/remap-text";
import type { WordTiming } from "@/domain/word/timing";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// -- Helpers ------------------------------------------------------------------

function withoutSplits(text: string | undefined, splitChar: string): string {
  return (text ?? "").replaceAll(splitChar, "");
}

function splitCount(text: string | undefined, splitChar: string): number {
  return (text ?? "").split(splitChar).length - 1;
}

function mostFinelySplit(
  copies: readonly LyricLine[],
  textOf: (line: LyricLine) => string | undefined,
  splitChar: string,
): LyricLine {
  return copies.reduce((finest, copy) =>
    splitCount(textOf(copy), splitChar) > splitCount(textOf(finest), splitChar) ? copy : finest,
  );
}

function wordTexts(text: string): string[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
  const endsWithSpace = text.endsWith(" ");
  return parts.map((part, i) => part + (trailingSpace[i] || (endsWithSpace && i === parts.length - 1) ? " " : ""));
}

// A partly synced track times only its first words, so only that prefix takes the new split.
function timedWordTexts(words: readonly WordTiming[], text: string, sourceText: string): string[] | null {
  const sourceWords = wordTexts(sourceText);
  if (words.length >= wordTexts(text).length) return sourceWords;
  const timed = words.map((word) => word.text).join("");
  let covered = "";
  for (let count = 1; count <= sourceWords.length; count++) {
    covered += sourceWords[count - 1];
    if (covered === timed) return sourceWords.slice(0, count);
    if (covered.length >= timed.length) return null;
  }
  return null;
}

function evenedWords(
  words: WordTiming[] | undefined,
  text: string | undefined,
  sourceText: string | undefined,
  splitChar: string,
): WordTiming[] | undefined | null {
  if (!words?.length || !text || !sourceText) return words;
  const targetTexts = timedWordTexts(words, text, sourceText);
  if (!targetTexts) return null;
  const target = reconstructLineText(
    targetTexts.map((wordText) => ({ text: wordText, begin: 0, end: 0 })),
    splitChar,
  );
  return remapWordTextsPreservingTiming(words, target).map((word, i) => ({ ...word, text: targetTexts[i] }));
}

function evenedCopy(copy: LyricLine, main: LyricLine, background: LyricLine, splitChar: string): LyricLine | null {
  if (!repeatsApartFromSplits(copy, main, splitChar)) return null;
  const mainChanged = copy.text !== main.text;
  const backgroundChanged = copy.backgroundText !== background.backgroundText;
  if (!mainChanged && !backgroundChanged) return copy;
  const words = mainChanged ? evenedWords(copy.words, copy.text, main.text, splitChar) : copy.words;
  const backgroundWords = backgroundChanged
    ? evenedWords(copy.backgroundWords, copy.backgroundText, background.backgroundText, splitChar)
    : copy.backgroundWords;
  if (words === null || backgroundWords === null) return null;
  return reconcileLine({
    ...copy,
    text: main.text,
    words,
    backgroundText: background.backgroundText,
    backgroundWords,
  });
}

// -- Functions ----------------------------------------------------------------

function repeatsApartFromSplits(a: LyricLine, b: LyricLine, splitChar: string): boolean {
  return (
    a.agentId === b.agentId &&
    withoutSplits(a.text, splitChar) === withoutSplits(b.text, splitChar) &&
    withoutSplits(a.backgroundText, splitChar) === withoutSplits(b.backgroundText, splitChar)
  );
}

// Null when a copy cannot take the finest split without changing its text or timing.
function withEvenSyllableSplits(
  lines: readonly LyricLine[],
  starts: readonly number[],
  length: number,
  splitChar: string,
): LyricLine[] | null {
  const result = [...lines];
  for (let offset = 0; offset < length; offset++) {
    const copies = starts.map((start) => lines[start + offset]);
    const main = mostFinelySplit(copies, (line) => line.text, splitChar);
    const background = mostFinelySplit(copies, (line) => line.backgroundText, splitChar);
    for (const start of starts) {
      const evened = evenedCopy(lines[start + offset], main, background, splitChar);
      if (!evened) return null;
      result[start + offset] = evened;
    }
  }
  return result;
}

// -- Exports ------------------------------------------------------------------

export { repeatsApartFromSplits, withEvenSyllableSplits };
