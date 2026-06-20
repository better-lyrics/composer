import type { Bounds } from "@/domain/word/bounds";
import { firstBegin, lastEnd } from "@/domain/word/bounds";
import type { Voice } from "@/domain/voice/model";
import { isLineSynced, isWordSynced } from "@/domain/voice/predicates";

// -- Functions ----------------------------------------------------------------

function voiceBounds(v: Voice): Bounds | null {
  if (isWordSynced(v)) return { begin: firstBegin(v.words), end: lastEnd(v.words) };
  if (isLineSynced(v)) return { begin: v.begin, end: v.end };
  return null;
}

// -- Exports ------------------------------------------------------------------

export { voiceBounds };
