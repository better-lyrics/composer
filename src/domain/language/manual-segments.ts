import type { TransliterationSegment } from "@/domain/language/model";
import type { LyricLine } from "@/domain/line/model";

// -- Segments -----------------------------------------------------------------

function manualSegments(line: LyricLine, value: string): TransliterationSegment[] {
  return value.trim() ? [{ original: line.text, transliteration: value.trim() }] : [];
}

// -- Exports ------------------------------------------------------------------

export { manualSegments };
