import type { LyricLine } from "@/domain/line/model";
import { isLineTimed } from "@/domain/line/sync-progress";

// -- Types --------------------------------------------------------------------

interface KeyedLine {
  line: LyricLine;
  key: string;
}

// -- Functions ----------------------------------------------------------------

function keyedExportLines(lines: readonly LyricLine[]): KeyedLine[] {
  return lines.filter(isLineTimed).map((line, index) => ({ line, key: `L${index + 1}` }));
}

// -- Exports ------------------------------------------------------------------

export { keyedExportLines };
