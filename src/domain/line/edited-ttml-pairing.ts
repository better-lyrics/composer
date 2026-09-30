import type { LyricLine } from "@/domain/line/model";
import type { LineKeyIds } from "@/utils/ttml-line-keys";

// -- Pairing ------------------------------------------------------------------

function pairEditedLines(
  stored: readonly LyricLine[],
  editedKeys: readonly (string | undefined)[],
  keyIds: LineKeyIds,
): (LyricLine | undefined)[] {
  const storedById = new Map(stored.map((line) => [line.id, line] as const));
  const seen = new Set<string>();
  return editedKeys.map((key) => {
    if (key === undefined || seen.has(key)) return undefined;
    seen.add(key);
    const id = keyIds[key];
    return id === undefined ? undefined : storedById.get(id);
  });
}

// -- Exports ------------------------------------------------------------------

export { pairEditedLines };
