import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { isYouTubeLoadError, loadVideoWithRollback, useLoadYouTubeSource } from "@/hooks/useLoadYouTubeSource";
import { type VideoProjectOutcome, openProjectForVideo } from "@/lib/open-video-project";
import { getPersistenceSettled, getQueryImportSettled, markLinkProjectSettled } from "@/lib/persistence-settled";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { showLinkedProjectToast } from "@/utils/project-toast";
import { hasLoadedYouTubeSourceFor } from "@/utils/youtube-source";
import { readYouTubeParam, stripYouTubeParams } from "@/utils/youtube-link-params";
import { extractVideoId } from "@/utils/youtube-url";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Boot]";

// -- Helpers ------------------------------------------------------------------

type CreatedVideoProject = Extract<VideoProjectOutcome, { kind: "created" }>;

function announceLinkedProject(outcome: CreatedVideoProject): void {
  void getQueryImportSettled().then(() => {
    showLinkedProjectToast(
      useProjectStore.getState().metadata.title,
      outcome.previousTitle,
      outcome.previousId,
      outcome.id,
    );
  });
}

function logLinkedVideoFailure(error: unknown): void {
  if (isYouTubeLoadError(error)) console.warn(LOG_PREFIX, "the linked video did not load", error);
  else console.error(LOG_PREFIX, "loading the linked video failed", error);
}

function loadCreatedProjectVideo(videoId: string, outcome: CreatedVideoProject): void {
  loadVideoWithRollback(videoId, outcome.id, outcome.previousId)
    .then(() => announceLinkedProject(outcome))
    .catch(logLinkedVideoFailure);
}

// -- Hook ---------------------------------------------------------------------

function useImportFromYouTube(): void {
  const loadYouTubeSource = useLoadYouTubeSource();
  const loadRef = useRef(loadYouTubeSource);
  loadRef.current = loadYouTubeSource;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = readYouTubeParam(new URLSearchParams(window.location.search));
    if (!raw) {
      markLinkProjectSettled("none");
      return;
    }

    const videoId = extractVideoId(raw);
    stripYouTubeParams();
    if (!videoId) {
      markLinkProjectSettled("none");
      toast.error("That URL doesn't look like a valid YouTube video");
      return;
    }

    let cancelled = false;
    getPersistenceSettled()
      .then(async () => {
        if (cancelled) {
          markLinkProjectSettled("none");
          return;
        }
        const outcome = await openProjectForVideo(videoId);
        markLinkProjectSettled(outcome.kind);
        if (outcome.kind === "created") {
          loadCreatedProjectVideo(videoId, outcome);
          return;
        }
        if (hasLoadedYouTubeSourceFor(useAudioStore.getState().source, videoId)) return;
        loadRef.current(videoId).catch(logLinkedVideoFailure);
      })
      .catch((error: unknown) => {
        console.error(`${LOG_PREFIX} could not open the project for the link`, error);
        markLinkProjectSettled("failed");
        toast.error("Couldn't open the project for that link");
      });

    return () => {
      cancelled = true;
    };
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useImportFromYouTube };
