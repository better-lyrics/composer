import type { TransliterationSegment } from "@/domain/language/model";
import type { LyricLine } from "@/domain/line/model";

// -- Segments -----------------------------------------------------------------

function wholeLineSegments(original: string, transliteration: string): TransliterationSegment[] {
  return [{ original, transliteration }];
}

function manualSegments(line: LyricLine, value: string): TransliterationSegment[] {
  return value.trim() ? wholeLineSegments(line.text, value.trim()) : [];
}

// -- Exports ------------------------------------------------------------------

export { manualSegments, wholeLineSegments };
