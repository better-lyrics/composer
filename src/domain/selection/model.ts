import type { WordTrack } from "@/domain/line/track";

// -- Types --------------------------------------------------------------------

// Names one word for as long as it exists: indexes go stale when words split, merge or move.
interface SyllableAddress {
  lineId: string;
  type: WordTrack;
  syllableId: string;
}

// -- Exports ------------------------------------------------------------------

export type { SyllableAddress };
