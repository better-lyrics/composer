import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import { type AddOutcome, addUnisonLyricsToProjects, undoAddedLyrics } from "@/lib/unison/add-unison-lyrics";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import {
  showAddedProjectsKeptToast,
  showLyricsAddedToProjectsToast,
  showNothingAddedToProjectsToast,
  showUnisonFailureToast,
} from "@/utils/unison-toast";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonAddAll]";
const FAILURE_TITLE = "Could not add your lyrics to Projects";

// -- Helpers -------------------------------------------------------------------

function undo(outcome: AddOutcome): void {
  undoAddedLyrics(outcome)
    .then((kept) => {
      if (kept > 0) showAddedProjectsKeptToast(kept);
    })
    .catch((error: unknown) => console.error(LOG_PREFIX, "could not undo adding lyrics to Projects", error));
}

function report(outcome: AddOutcome): void {
  const added = outcome.created.length;
  const linked = outcome.linked.length;
  if (added > 0 || linked > 0) {
    showLyricsAddedToProjectsToast({ ...outcome, added, linked }, () => undo(outcome));
  } else if (outcome.failed === 0 && outcome.unresolved > 0) {
    showNothingAddedToProjectsToast(outcome.unresolved);
  } else {
    showUnisonFailureToast(FAILURE_TITLE, outcome.lastError);
  }
}

// -- Hook ----------------------------------------------------------------------

function useAddAllToProjects() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const addAll = async (items: readonly UnisonMineItem[]) => {
    if (busy) return;
    setBusy(true);
    try {
      report(await addUnisonLyricsToProjects(items, (lyricId) => fetchUnisonLyric(queryClient, Number(lyricId))));
    } catch (error) {
      console.error(LOG_PREFIX, "could not add lyrics to Projects", error);
      showUnisonFailureToast(FAILURE_TITLE, error);
    } finally {
      setBusy(false);
    }
  };

  return { busy, addAll };
}

// -- Exports -------------------------------------------------------------------

export { useAddAllToProjects };
