import type { TransliterationSegment } from "insync/language";
import type { LyricLine } from "insync/line";
import { lineText } from "insync/line-text";

// -- Segments -----------------------------------------------------------------

function wholeLineSegments(original: string, transliteration: string): TransliterationSegment[] {
  return [{ original, transliteration }];
}

function manualSegments(line: LyricLine, value: string, splitChar: string): TransliterationSegment[] {
  return value.trim() ? wholeLineSegments(lineText(line, splitChar), value.trim()) : [];
}

// -- Exports ------------------------------------------------------------------

export { manualSegments, wholeLineSegments };
