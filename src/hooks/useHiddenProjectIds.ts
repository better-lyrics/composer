import { hiddenProjectIdsSnapshot, subscribeHiddenProjectIds } from "@/lib/pending-deletions";
import { useSyncExternalStore } from "react";

// -- Constants ----------------------------------------------------------------

const NOTHING_HIDDEN: ReadonlySet<string> = new Set();

// -- Helpers ------------------------------------------------------------------

function nothingHiddenOnServer(): ReadonlySet<string> {
  return NOTHING_HIDDEN;
}

// -- Hook ---------------------------------------------------------------------

function useHiddenProjectIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeHiddenProjectIds, hiddenProjectIdsSnapshot, nothingHiddenOnServer);
}

// -- Exports ------------------------------------------------------------------

export { useHiddenProjectIds };
