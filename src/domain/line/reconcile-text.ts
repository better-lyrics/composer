import { reconcileLine, toFlat, type LyricLine } from "@/domain/line/model";
import { lineText, mainWords } from "@/domain/line/voices";
import { remapWordTextsPreservingTiming } from "@/domain/word/remap-text";

// The single chokepoint for re-deciding timing-staleness after a text edit:
// both the exact-match and position-match branches of textToLyricLines route
// through here so they cannot drift apart and clear timing on lines the user
// never touched.
function reconcileMatchedTiming(line: LyricLine, cleanedText: string): LyricLine {
  if (lineText(line) === cleanedText) return line;

  const words = mainWords(line);
  if (words && words.length > 0) {
    const remapped = remapWordTextsPreservingTiming(words, cleanedText);
    if (remapped) {
      return reconcileLine({ ...toFlat(line), text: cleanedText, words: remapped });
    }
  }

  return reconcileLine({ ...toFlat(line), text: cleanedText, words: undefined, begin: undefined, end: undefined });
}

export { reconcileMatchedTiming };
