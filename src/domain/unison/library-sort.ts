import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { byMostRecentlyEdited } from "@/domain/project/library-order";

// -- Types ---------------------------------------------------------------------

type UnisonSort = "unison-score" | "unison-changed" | "unison-sent";

interface UnisonStanding {
  score: number;
  voteCount: number;
  changedAt: number;
  sentAt: number;
}

type ProjectComparator = (a: ProjectIndexEntry, b: ProjectIndexEntry) => number;

// -- Constants -----------------------------------------------------------------

const UNISON_SORTS: readonly UnisonSort[] = ["unison-score", "unison-changed", "unison-sent"];

const STANDING_ORDER: Record<UnisonSort, (a: UnisonStanding, b: UnisonStanding) => number> = {
  "unison-score": (a, b) => b.score - a.score || b.voteCount - a.voteCount,
  "unison-changed": (a, b) => b.changedAt - a.changedAt,
  "unison-sent": (a, b) => b.sentAt - a.sentAt,
};

// -- Functions -----------------------------------------------------------------

function isUnisonSort(value: unknown): value is UnisonSort {
  return typeof value === "string" && (UNISON_SORTS as readonly string[]).includes(value);
}

// Projects without a lyric on Unison go last, in edited order.
function compareByUnison(sort: UnisonSort, standings: ReadonlyMap<string, UnisonStanding>): ProjectComparator {
  return (a, b) => {
    const standingA = standings.get(a.id);
    const standingB = standings.get(b.id);
    if (!standingA || !standingB) {
      if (standingA !== standingB) return standingA ? -1 : 1;
      return byMostRecentlyEdited(a, b);
    }
    return STANDING_ORDER[sort](standingA, standingB) || byMostRecentlyEdited(a, b);
  };
}

// -- Exports -------------------------------------------------------------------

export type { UnisonSort, UnisonStanding };
export { compareByUnison, isUnisonSort, UNISON_SORTS };
