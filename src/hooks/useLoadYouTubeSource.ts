import { useCallback } from "react";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";

// -- Hook ---------------------------------------------------------------------

function useLoadYouTubeSource(): (videoId: string) => void {
  return useCallback((videoId: string) => {
    useAudioStore.getState().setYouTubeSource(videoId);
    const project = useProjectStore.getState();
    if (!project.metadata.title) project.setMetadata({ title: videoId });
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useLoadYouTubeSource };
