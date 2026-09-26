import { reconcileLine, type LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { remapWordTextsPreservingTiming } from "@/domain/word/remap-text";

// The single chokepoint for re-deciding timing-staleness after a text edit:
// both the exact-match and position-match branches of textToLyricLines route
// through here so they cannot drift apart and clear timing on lines the user
// never touched.
function reconcileMatchedTiming(line: LyricLine, cleanedText: string): LyricLine {
  if (line.text === cleanedText) return line;

  if (cleanedText !== "" && line.words?.length) {
    return reconcileLine({
      ...line,
      text: cleanedText,
      words: remapWordTextsPreservingTiming(line.words, cleanedText),
    });
  }

  if (cleanedText !== "" && isLineSynced(line)) {
    return reconcileLine({ ...line, text: cleanedText });
  }

  return reconcileLine({ ...line, text: cleanedText, words: undefined, begin: undefined, end: undefined });
}

export { reconcileMatchedTiming };
