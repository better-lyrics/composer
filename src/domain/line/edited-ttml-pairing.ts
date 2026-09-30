import type { LyricLine } from "@/domain/line/model";
import { keyedExportLines } from "@/utils/ttml-line-keys";

// -- Pairing ------------------------------------------------------------------

function pairEditedLines(
  stored: readonly LyricLine[],
  editedKeys: readonly (string | undefined)[],
): (LyricLine | undefined)[] {
  const storedByKey = new Map(keyedExportLines(stored).map(({ line, key }) => [key, line] as const));
  const seen = new Set<string>();
  return editedKeys.map((key) => {
    if (key === undefined || seen.has(key)) return undefined;
    seen.add(key);
    return storedByKey.get(key);
  });
}

// -- Exports ------------------------------------------------------------------

export { pairEditedLines };
