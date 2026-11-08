import { type UnisonStatus, unisonStatus } from "@/domain/unison/lyric-status";
import type { UnisonConfidence, UnisonMineItem } from "@/lib/unison/api-types";

// -- Types ---------------------------------------------------------------------

type MineSortKey = "song" | "status" | "score" | "confidence";
type SortDirection = "asc" | "desc";

interface MineSort {
  key: MineSortKey;
  direction: SortDirection;
}

// -- Constants -----------------------------------------------------------------

const STATUS_ORDER: Record<UnisonStatus, number> = {
  sealed: 0,
  live: 1,
  pending: 2,
  declined: 3,
  hidden: 4,
  removed: 5,
};

const CONFIDENCE_ORDER: Record<UnisonConfidence, number> = { low: 0, medium: 1, high: 2 };

// Text reads A to Z first; numbers read best first.
const FIRST_DIRECTION: Record<MineSortKey, SortDirection> = {
  song: "asc",
  status: "asc",
  score: "desc",
  confidence: "desc",
};

const COLLATOR = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

// -- Functions -----------------------------------------------------------------

function compareMine(key: MineSortKey, a: UnisonMineItem, b: UnisonMineItem): number {
  if (key === "song") return COLLATOR.compare(a.song, b.song) || COLLATOR.compare(a.artist, b.artist);
  if (key === "status") return STATUS_ORDER[unisonStatus(a)] - STATUS_ORDER[unisonStatus(b)];
  if (key === "score") return a.score - b.score || a.voteCount - b.voteCount;
  return CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
}

function sortedMine(items: readonly UnisonMineItem[], sort: MineSort | null): readonly UnisonMineItem[] {
  if (!sort) return items;
  const sign = sort.direction === "asc" ? 1 : -1;
  return items.toSorted((a, b) => sign * compareMine(sort.key, a, b));
}

// A new column starts in its natural direction, the same column flips, and a third click restores the server order.
function nextMineSort(current: MineSort | null, key: MineSortKey): MineSort | null {
  if (current?.key !== key) return { key, direction: FIRST_DIRECTION[key] };
  if (current.direction === FIRST_DIRECTION[key])
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return null;
}

// -- Exports -------------------------------------------------------------------

export type { MineSort, MineSortKey };
export { nextMineSort, sortedMine };
