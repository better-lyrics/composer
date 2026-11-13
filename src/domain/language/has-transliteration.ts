import { lineTransliteration } from "@/domain/language/line-languages";
import type { LyricLine } from "@/domain/line/model";

// -- Functions -----------------------------------------------------------------

function hasTransliteration(lines: readonly LyricLine[]): boolean {
  return lines.some((line) => {
    const track = lineTransliteration(line);
    return !!(track?.main.text || track?.bg?.text);
  });
}

// -- Exports -------------------------------------------------------------------

export { hasTransliteration };
