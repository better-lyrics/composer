import { lineTransliteration } from "@/domain/language/line-languages";
import { withoutPieces } from "@/domain/language/pieces";
import type { LyricLine } from "@/domain/line/model";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Functions ----------------------------------------------------------------

// Pieces are a cache that merges and splits rewrite, so only the reading itself counts as an edit.
function sameTransliteration(a: LyricLine | undefined, b: LyricLine | undefined): boolean {
  const before = a && lineTransliteration(a);
  const after = b && lineTransliteration(b);
  if (before === after) return true;
  return !!before && !!after && isStructurallyEqual(withoutPieces(before), withoutPieces(after));
}

// -- Exports ------------------------------------------------------------------

export { sameTransliteration };
