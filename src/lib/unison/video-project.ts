import { isYouTubeLoadError, isYouTubeLoadFailure, loadVideoWithRollback } from "@/hooks/useLoadYouTubeSource";
import { startSongInNewProject } from "@/lib/open-project";
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

async function startVideoProject({ videoId, title, prepare, navigate }: VideoProjectStart): Promise<void> {
  const started = await startSongInNewProject(title, (song) => {
    prepare();
    return song;
  });
  if (!started) {
    toast.error(COULD_NOT_START_MESSAGE);
    return;
  }
  navigate(EDITOR_PATH);
  try {
    await loadVideoWithRollback(videoId, started.newId, started.previousId);
  } catch (error) {
    if (isYouTubeLoadFailure(error)) toast.error(error.message);
    else if (!isYouTubeLoadError(error)) console.error(LOG_PREFIX, "could not load the video", error);
    return;
  }
  showNewProjectToast(
    useProjectStore.getState().metadata.title,
    started.previousTitle,
    started.previousId,
    started.newId,
  );
}

// -- Exports -------------------------------------------------------------------

export { startVideoProject };
