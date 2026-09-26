import { useCallback } from "react";
import { shallow } from "zustand/shallow";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { confirmClearImportedSongDetails } from "@/hooks/imported-song-details";
import { type AudioSource, useAudioStore } from "@/stores/audio";
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
      project.clearUnexportedImport();
      return waitForYouTubeLoad(videoId);
    }

    const loading = waitForYouTubeLoad(videoId);
    let undoReset: (() => void) | null = null;
    if (!project.hasUnexportedImport) {
      undoReset = resetSongIdentityForVideo(videoId, previous);
    } else {
      void confirmClearImportedSongDetails().then((clear) => {
        if (!matchesPending(useAudioStore.getState().source, videoId)) return;
        if (clear) undoReset = resetSongIdentityForVideo(videoId, previous);
        else useProjectStore.getState().clearUnexportedImport();
      });
    }
    return loading.catch((error: unknown) => {
      undoReset?.();
      throw error;
    });
  }, []);
}

function resetSongIdentityForVideo(videoId: string, previous: AudioSource): () => void {
  const project = useProjectStore.getState();
  const { metadata, agents, hasUnexportedImport } = project;
  project.resetSongIdentity(videoId);
  const resetState = useProjectStore.getState();
  return () => {
    const current = useProjectStore.getState();
    const loadFellBackToPrevious = useAudioStore.getState().source === previous;
    const untouchedSinceReset =
      current.agents === resetState.agents &&
      shallow(withoutThumbnailOf(current.metadata, videoId), resetState.metadata);
    if (loadFellBackToPrevious && untouchedSinceReset) {
      current.restoreSongIdentity({ metadata, agents, hasUnexportedImport });
    }
  };
}

function withoutThumbnailOf(metadata: ProjectMetadata, videoId: string): ProjectMetadata {
  if (metadata.thumbnailForVideoId !== videoId) return metadata;
  return { ...metadata, thumbnailDataUrl: undefined, thumbnailForVideoId: undefined };
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
