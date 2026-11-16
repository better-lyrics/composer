import { invalidateLyricWrite, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { noteGuideSignal } from "@/lib/guide-signals";
import type { LyricsSubmission } from "@/lib/unison/api-types";
import { linkVideo, saveRevision, submitLyrics } from "@/lib/unison/endpoints";
import { captureLinkTarget, linkProjectToLyric } from "@/lib/unison/project-link";
import type { RevisionInput } from "@/lib/unison/revision-types";
import { showSubmittedToast, showSuggestionSentToast, showUpdateSentToast } from "@/utils/unison-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

type UnisonSendRequest =
  | { kind: "new"; submission: LyricsSubmission; videoIds?: readonly string[] }
  | { kind: "update"; lyricId: number; input: RevisionInput }
  | {
      kind: "suggest";
      lyricId: number;
      input: RevisionInput;
      note?: string;
      owner: string | null;
      ownerDecisionSec: number | null;
    };

type SuggestRequest = Extract<UnisonSendRequest, { kind: "suggest" }>;

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

const FAILURE_VERBS: Record<UnisonSendRequest["kind"], string> = {
  new: "submit",
  update: "send the update",
  suggest: "send the suggestion",
};

// -- Helpers -------------------------------------------------------------------

async function linkExtraVideos(lyricId: number, videoIds: readonly string[]): Promise<string[]> {
  const unlinked: string[] = [];
  for (const videoId of videoIds) {
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- links run in order so Unison keeps the order the user picked, and the server takes a row lock per link anyway
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
      queryClient.invalidateQueries({ queryKey: unisonQueryKeys.videoLinks(lyricId) }),
    ]);

  const submitNew = async (submission: LyricsSubmission, videoIds: readonly string[]) => {
    const linkTarget = captureLinkTarget();
    const { id } = await submitLyrics(submission);
    // The request can outlive a project switch; the link goes to the project that sent it.
    await linkProjectToLyric(linkTarget, String(id));
    const unlinked = await linkExtraVideos(id, videoIds);
    showSubmittedToast(unlinked);
    noteGuideSignal("export.unisonSubmit");
    await refresh(id);
  };

  const sendUpdate = async (lyricId: number, input: RevisionInput) => {
    const { revision } = await saveRevision(lyricId, input);
    showUpdateSentToast(revision.status === "live");
    noteGuideSignal("export.unisonUpdate");
    await refresh(lyricId);
  };

  const sendSuggestion = async ({ lyricId, input, note, owner, ownerDecisionSec }: SuggestRequest) => {
    const { decider } = await saveRevision(lyricId, input, note);
    showSuggestionSentToast(decider, owner, ownerDecisionSec);
    await refresh(lyricId);
  };

  const send = async (request: UnisonSendRequest) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    try {
      if (request.kind === "new") await submitNew(request.submission, request.videoIds ?? []);
      else if (request.kind === "update") await sendUpdate(request.lyricId, request.input);
      else await sendSuggestion(request);
    } catch (error) {
      console.warn(LOG_PREFIX, `Could not ${FAILURE_VERBS[request.kind]}`, error);
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

export { useSubmitToUnison };
