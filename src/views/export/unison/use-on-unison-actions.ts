import { quotedTitle } from "@/domain/project/display-title";
import { invalidateLyricWrite } from "@/hooks/unison/query-keys";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { deleteLyrics, withdrawPendingRevision } from "@/lib/unison/endpoints";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { pluralize } from "@/utils/pluralize";
import { showEditWithdrawnToast, showRemovedFromUnisonToast, showUnisonFailureToast } from "@/utils/unison-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

interface OnUnisonActions {
  busy: boolean;
  remove: () => Promise<void>;
  withdraw: () => Promise<void>;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonExport]";
const KEEP_PROJECT_SENTENCE = "Your project stays here, and you can submit it again later.";

// -- Copy ----------------------------------------------------------------------

function removeDescription(voteCount: number): string {
  if (voteCount === 0) return `Better Lyrics listeners stop seeing this version. ${KEEP_PROJECT_SENTENCE}`;
  const votesAreGone = `${pluralize(voteCount, "vote")} ${voteCount === 1 ? "is" : "are"} gone for good`;
  return `Better Lyrics listeners stop seeing this version, and its ${votesAreGone}. ${KEEP_PROJECT_SENTENCE}`;
}

// -- Hook ----------------------------------------------------------------------

function useOnUnisonActions(lyric: UnisonLyric, keyId: string): OnUnisonActions {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const refresh = () => invalidateLyricWrite(queryClient, lyric.id, keyId);

  const run = async (write: () => Promise<void>, failureTitle: string) => {
    setBusy(true);
    try {
      await write();
    } catch (error) {
      console.warn(LOG_PREFIX, failureTitle, error);
      showUnisonFailureToast(failureTitle, error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const confirmed = await confirm({
      title: `Remove ${quotedTitle(useProjectStore.getState().metadata.title)} from Unison?`,
      description: removeDescription(lyric.voteCount),
      confirmLabel: "Remove from Unison",
      cancelLabel: "Keep it",
      variant: "destructive",
    });
    if (!confirmed) return;
    await run(async () => {
      await deleteLyrics(lyric.id);
      const project = useProjectStore.getState();
      // The request can outlive a project switch; only the project that is still linked loses its link.
      if (project.unisonLyricId === String(lyric.id)) project.unlinkUnisonLyric();
      showRemovedFromUnisonToast();
      await refresh();
    }, "Could not remove from Unison");
  };

  const withdraw = () =>
    run(async () => {
      await withdrawPendingRevision(lyric.id);
      showEditWithdrawnToast();
      await refresh();
    }, "Could not withdraw the edit");

  return { busy, remove, withdraw };
}

// -- Exports -------------------------------------------------------------------

export { useOnUnisonActions };
