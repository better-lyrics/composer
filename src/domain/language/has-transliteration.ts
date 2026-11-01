import type { LyricLine } from "@/domain/line/model";

// -- Functions -----------------------------------------------------------------

function hasTransliteration(lines: readonly LyricLine[]): boolean {
  return lines.some((line) => !!(line.transliteration?.text || line.transliteration?.backgroundText));
}

// -- Exports -------------------------------------------------------------------

export { hasTransliteration };
