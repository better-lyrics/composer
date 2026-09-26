import { useCallback } from "react";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";

// -- Hook ---------------------------------------------------------------------

function useLoadYouTubeSource(): (videoId: string) => Promise<void> {
  return useCallback((videoId: string) => {
    const audio = useAudioStore.getState();
    const previous = audio.source;
    const prevVideoId = previous?.type === "youtube" ? previous.videoId : null;
    audio.setYouTubeSource(videoId);

    const project = useProjectStore.getState();
    if (previous == null || prevVideoId === videoId) {
      if (!project.metadata.title || prevVideoId !== videoId) project.setMetadata({ title: videoId });
      return waitForYouTubeLoad(videoId);
    }

    const { metadata, agents } = project;
    project.resetSongIdentity(videoId);
    const resetState = useProjectStore.getState();
    return waitForYouTubeLoad(videoId).catch((error: unknown) => {
      const current = useProjectStore.getState();
      const loadFellBackToPrevious = useAudioStore.getState().source === previous;
      const untouchedSinceReset = current.metadata === resetState.metadata && current.agents === resetState.agents;
      if (loadFellBackToPrevious && untouchedSinceReset) {
        current.setMetadata(metadata);
        current.setAgents(agents);
      }
      throw error;
    });
  }, []);
}

function waitForYouTubeLoad(videoId: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const unsubscribe = useAudioStore.subscribe((state) => {
      if (matchesLoaded(state.source, videoId)) {
        unsubscribe();
        resolve();
        return;
      }
      if (state.youtubeLoadError) {
        unsubscribe();
        reject(new Error(state.youtubeLoadError));
        return;
      }
      if (!matchesPending(state.source, videoId)) {
        unsubscribe();
        reject(new Error("youtube_load_superseded"));
      }
    });
  });
}

function matchesLoaded(source: ReturnType<typeof useAudioStore.getState>["source"], videoId: string): boolean {
  return source?.type === "youtube" && source.videoId === videoId && source.file != null;
}

function matchesPending(source: ReturnType<typeof useAudioStore.getState>["source"], videoId: string): boolean {
  return source?.type === "youtube" && source.videoId === videoId;
}

// -- Exports ------------------------------------------------------------------

export { useLoadYouTubeSource };
