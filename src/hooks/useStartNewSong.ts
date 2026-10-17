import { useLoadAudioFile } from "@/hooks/useLoadAudioFile";
import { isYouTubeLoadError, isYouTubeLoadFailure, loadVideoWithRollback } from "@/hooks/useLoadYouTubeSource";
import { createProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { useProjectStore } from "@/stores/project";
import { EDITOR_PATH, LIBRARY_PATH } from "@/utils/app-routes";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface NewSongStarters {
  startWithFile: (file: File) => void;
  startWithVideo: (videoId: string) => void;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[NewSong]";

// -- Hook ---------------------------------------------------------------------

function useStartNewSong(): NewSongStarters {
  const navigate = useNavigate();
  const loadAudioFile = useLoadAudioFile();

  return useMemo(
    () => ({
      startWithFile: (file: File) => {
        createProject();
        navigate(EDITOR_PATH);
        loadAudioFile(file);
      },
      startWithVideo: (videoId: string) => {
        const newId = createProject();
        useProjectStore.getState().setMetadata({ title: videoId });
        navigate(EDITOR_PATH);
        loadVideoWithRollback(videoId, newId, undefined).catch((error: unknown) => {
          if (isYouTubeLoadFailure(error) && openProjectIdSnapshot() !== newId) {
            navigate(LIBRARY_PATH);
            toast.error(error.message);
            return;
          }
          if (!isYouTubeLoadError(error)) console.error(LOG_PREFIX, "could not load the video", error);
        });
      },
    }),
    [navigate, loadAudioFile],
  );
}

// -- Exports ------------------------------------------------------------------

export { useStartNewSong };
