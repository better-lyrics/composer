import { lineTransliteration } from "@/domain/language/line-languages";
import type { LyricLine } from "insync/line";

// -- Functions -----------------------------------------------------------------

function hasTransliteration(lines: readonly LyricLine[]): boolean {
  return lines.some((line) => {
    const track = lineTransliteration(line);
    return !!(track?.main.text || track?.bg?.text);
  });
}

// -- Exports -------------------------------------------------------------------

export { hasTransliteration };
