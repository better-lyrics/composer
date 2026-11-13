import type { TransliterationSegment } from "@/domain/language/model";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";

// -- Segments -----------------------------------------------------------------

function wholeLineSegments(original: string, transliteration: string): TransliterationSegment[] {
  return [{ original, transliteration }];
}

function manualSegments(line: LyricLine, value: string): TransliterationSegment[] {
  return value.trim() ? wholeLineSegments(lineText(line), value.trim()) : [];
}

// -- Exports ------------------------------------------------------------------

export { manualSegments, wholeLineSegments };
