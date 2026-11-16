import { isYouTubeLoadError, isYouTubeLoadFailure, loadVideoWithRollback } from "@/hooks/useLoadYouTubeSource";
import { type NewSongProject, startSongInNewProject } from "@/lib/open-project";
import { useProjectStore } from "@/stores/project";
import { EDITOR_PATH } from "@/utils/app-routes";
import { showNewProjectToast } from "@/utils/project-toast";
import { toast } from "sonner";

// -- Types ---------------------------------------------------------------------

interface VideoProjectStart {
  videoId: string;
  title: string;
  prepare: () => void;
  navigate: (path: string) => void;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonProject]";
const COULD_NOT_START_MESSAGE = "Couldn't start a new project";

// -- Starting ------------------------------------------------------------------

async function createVideoProject({ title, prepare, navigate }: VideoProjectStart): Promise<NewSongProject | null> {
  const started = await startSongInNewProject(title, (song) => {
    prepare();
    return song;
  });
  if (!started) {
    toast.error(COULD_NOT_START_MESSAGE);
    return null;
  }
  navigate(EDITOR_PATH);
  return started;
}

async function loadVideoProject(videoId: string, started: NewSongProject): Promise<boolean> {
  try {
    await loadVideoWithRollback(videoId, started.newId, started.previousId);
    return true;
  } catch (error) {
    if (isYouTubeLoadFailure(error)) toast.error(error.message);
    else if (!isYouTubeLoadError(error)) console.error(LOG_PREFIX, "could not load the video", error);
    return false;
  }
}

function announceVideoProject(started: NewSongProject): void {
  showNewProjectToast(
    useProjectStore.getState().metadata.title,
    started.previousTitle,
    started.previousId,
    started.newId,
  );
}

async function startVideoProject(start: VideoProjectStart): Promise<void> {
  const started = await createVideoProject(start);
  if (started && (await loadVideoProject(start.videoId, started))) announceVideoProject(started);
}

// -- Exports -------------------------------------------------------------------

export { announceVideoProject, createVideoProject, loadVideoProject, startVideoProject };
export type { VideoProjectStart };
