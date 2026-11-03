import { isSealed } from "@/domain/unison/lyric-status";
import { invalidateLyricWrite } from "@/hooks/unison/query-keys";
import { fetchRevisionContent } from "@/hooks/unison/useRevisions";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { revertRevision } from "@/lib/unison/endpoints";
import { readUnisonLyric } from "@/lib/unison/open-unison-lyric";
import type { RevisionSummary } from "@/lib/unison/revision-types";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { showRevisionLoadedToast, showRevisionRestoredToast, showUnisonFailureToast } from "@/utils/unison-toast";
import { replaceWithParsedLyrics } from "@/views/lyrics-import-modal/import-lyrics";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

// -- Types ---------------------------------------------------------------------

type RevisionAction = "load" | "make-live";

interface RevisionActions {
  busy: RevisionAction | null;
  loadIntoProject: (revision: RevisionSummary) => Promise<void>;
  makeLive: (revision: RevisionSummary) => Promise<void>;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonHistory]";

// -- Copy ----------------------------------------------------------------------

function makeLiveConfirm(revNo: number, liveRevNo: number, sealed: boolean) {
  if (sealed) {
    return {
      title: `Send revision ${revNo} for review?`,
      description: `This lyric is sealed, so the council checks it first. Listeners keep revision ${liveRevNo} until then.`,
      confirmLabel: "Send for review",
    };
  }
  return {
    title: `Make revision ${revNo} live?`,
    description: `Listeners see it in place of revision ${liveRevNo}. If it differs a lot, the council checks it first.`,
    confirmLabel: "Make it live",
  };
}

// -- Hook ----------------------------------------------------------------------

function useRevisionActions(lyric: UnisonLyric, keyId: string, onRestored: (revNo: number) => void): RevisionActions {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<RevisionAction | null>(null);

  const run = async (action: RevisionAction, write: () => Promise<void>, failureTitle: string) => {
    setBusy(action);
    try {
      await write();
    } catch (error) {
      console.warn(LOG_PREFIX, failureTitle, error);
      showUnisonFailureToast(failureTitle, error);
    } finally {
      setBusy(null);
    }
  };

  const loadIntoProject = (revision: RevisionSummary) =>
    run(
      "load",
      async () => {
        const session = useProjectStore.getState().projectSession;
        const content = await fetchRevisionContent(queryClient, lyric.id, revision.id);
        // The fetch can outlive a project switch; only the project that asked loads it.
        const project = useProjectStore.getState();
        if (project.projectSession !== session || project.unisonLyricId !== String(lyric.id)) return;
        const read = readUnisonLyric({ song: lyric.song, format: content.format, lyrics: content.lyrics });
        if (read.status === "unreadable") {
          toast.error(read.message);
          return;
        }
        showRevisionLoadedToast(revision.revNo, replaceWithParsedLyrics(read.parsed));
      },
      `Could not load revision ${revision.revNo}`,
    );

  const makeLive = async (revision: RevisionSummary) => {
    const confirmed = await confirm({
      ...makeLiveConfirm(revision.revNo, lyric.revision.revNo, isSealed(lyric)),
      variant: "primary",
    });
    if (!confirmed) return;
    await run(
      "make-live",
      async () => {
        const restored = await revertRevision(lyric.id, revision.id);
        showRevisionRestoredToast(revision.revNo, restored.status === "live");
        await invalidateLyricWrite(queryClient, lyric.id, keyId);
        onRestored(restored.revNo);
      },
      `Could not restore revision ${revision.revNo}`,
    );
  };

  return { busy, loadIntoProject, makeLive };
}

// -- Exports -------------------------------------------------------------------

export { useRevisionActions };
export type { RevisionActions };
