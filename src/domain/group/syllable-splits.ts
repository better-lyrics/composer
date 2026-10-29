import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { reconcileMatchedTiming } from "@/domain/line/reconcile-text";
import { remapWordTextsPreservingTiming } from "@/domain/word/remap-text";

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

function withBackgroundText(line: LyricLine, backgroundText: string | undefined): LyricLine {
  if (!backgroundText || !line.backgroundWords?.length) return reconcileLine({ ...line, backgroundText });
  return reconcileLine({
    ...line,
    backgroundText,
    backgroundWords: remapWordTextsPreservingTiming(line.backgroundWords, backgroundText),
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

function withEvenSyllableSplits(
  lines: readonly LyricLine[],
  starts: readonly number[],
  length: number,
  splitChar: string,
): LyricLine[] {
  const result = [...lines];
  for (let offset = 0; offset < length; offset++) {
    const copies = starts.map((start) => lines[start + offset]);
    const mainSource = mostFinelySplit(copies, (line) => line.text, splitChar);
    const backgroundSource = mostFinelySplit(copies, (line) => line.backgroundText, splitChar);
    for (const start of starts) {
      const copy = lines[start + offset];
      if (!repeatsApartFromSplits(copy, mainSource, splitChar)) continue;
      let evened = copy.text === mainSource.text ? copy : reconcileMatchedTiming(copy, mainSource.text);
      if (evened.backgroundText !== backgroundSource.backgroundText) {
        evened = withBackgroundText(evened, backgroundSource.backgroundText);
      }
      result[start + offset] = evened;
    }
  }
  return result;
}

// -- Exports ------------------------------------------------------------------

export { repeatsApartFromSplits, withEvenSyllableSplits };
