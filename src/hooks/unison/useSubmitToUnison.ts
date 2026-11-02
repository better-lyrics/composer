import { invalidateLyricWrite, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import type { LyricsSubmission } from "@/lib/unison/api-types";
import { linkVideo, saveRevision, submitLyrics } from "@/lib/unison/endpoints";
import type { RevisionInput } from "@/lib/unison/revision-types";
import { useProjectStore } from "@/stores/project";
import { showSubmittedToast, showUpdateSentToast } from "@/utils/unison-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

type UnisonSendRequest =
  | { kind: "new"; submission: LyricsSubmission; videoIds?: readonly string[] }
  | { kind: "update"; lyricId: number; input: RevisionInput };

interface SendFailure {
  error: unknown;
  lyrics: string;
}

interface UnisonSend {
  pending: boolean;
  failure: SendFailure | null;
  send: (request: UnisonSendRequest) => Promise<void>;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonSubmit]";

// -- Helpers -------------------------------------------------------------------

function openProjectIdentity(): string {
  return `${openProjectIdSnapshot() ?? ""}:${useProjectStore.getState().projectSession}`;
}

async function linkExtraVideos(lyricId: number, videoIds: readonly string[]): Promise<string[]> {
  const unlinked: string[] = [];
  for (const videoId of videoIds) {
    try {
      await linkVideo(lyricId, videoId);
    } catch (error) {
      console.warn(LOG_PREFIX, `Could not link video ${videoId} to lyric ${lyricId}`, error);
      unlinked.push(videoId);
    }
  }
  return unlinked;
}

// -- Hook ----------------------------------------------------------------------

function useSubmitToUnison(keyId: string, onError: (error: unknown) => void): UnisonSend {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<SendFailure | null>(null);
  const inFlight = useRef(false);

  const refresh = (lyricId: number) =>
    Promise.all([
      invalidateLyricWrite(queryClient, lyricId, keyId),
      queryClient.invalidateQueries({ queryKey: unisonQueryKeys.revisionPreviews(lyricId) }),
      queryClient.invalidateQueries({ queryKey: unisonQueryKeys.allVariants() }),
      queryClient.invalidateQueries({ queryKey: unisonQueryKeys.videoLinks(lyricId) }),
    ]);

  const submitNew = async (submission: LyricsSubmission, videoIds: readonly string[]) => {
    const startedIn = openProjectIdentity();
    const { id } = await submitLyrics(submission);
    // The request can outlive a project switch; only the project that sent it gets the link.
    if (openProjectIdentity() === startedIn) useProjectStore.getState().linkUnisonLyric(String(id));
    const unlinked = await linkExtraVideos(id, videoIds);
    showSubmittedToast(unlinked);
    await refresh(id);
  };

  const sendUpdate = async (lyricId: number, input: RevisionInput) => {
    const revision = await saveRevision(lyricId, input);
    showUpdateSentToast(revision.status === "live");
    await refresh(lyricId);
  };

  const send = async (request: UnisonSendRequest) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    try {
      if (request.kind === "new") await submitNew(request.submission, request.videoIds ?? []);
      else await sendUpdate(request.lyricId, request.input);
    } catch (error) {
      console.warn(LOG_PREFIX, `Could not ${request.kind === "new" ? "submit" : "send the update"}`, error);
      const lyrics = request.kind === "new" ? request.submission.lyrics : request.input.lyrics;
      setFailure({ error, lyrics });
      onError(error);
      if (request.kind === "new") {
        void queryClient.invalidateQueries({ queryKey: unisonQueryKeys.variants(request.submission.videoId) });
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return { pending, failure, send };
}

// -- Exports -------------------------------------------------------------------

export type { SendFailure, UnisonSendRequest };
export { useSubmitToUnison };
