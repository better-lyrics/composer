import { hasLyricLines } from "@/domain/project/lyrics-presence";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { confirmClearImportedSongDetails } from "@/hooks/imported-song-details";
import { deleteProject, openProject, startSongInNewProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { type AudioSource, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { showNewProjectToast } from "@/utils/project-toast";
import { hasLoadedYouTubeSourceFor, isYouTubeSourceFor } from "@/utils/youtube-source";
import { useCallback } from "react";
import { shallow } from "zustand/shallow";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[YouTubeSource]";

// -- Errors -------------------------------------------------------------------

class YouTubeLoadSupersededError extends Error {
  constructor() {
    super("youtube_load_superseded");
    this.name = "YouTubeLoadSupersededError";
  }
}

class YouTubeLoadFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeLoadFailedError";
  }
}

function isYouTubeLoadError(error: unknown): boolean {
  return error instanceof YouTubeLoadFailedError || error instanceof YouTubeLoadSupersededError;
}

function isYouTubeLoadFailure(error: unknown): error is YouTubeLoadFailedError {
  return error instanceof YouTubeLoadFailedError;
}

// -- Hook ---------------------------------------------------------------------

function useLoadYouTubeSource(): (videoId: string) => Promise<void> {
  return useCallback((videoId: string) => {
    const previous = useAudioStore.getState().source;
    const prevVideoId = previous?.type === "youtube" ? previous.videoId : null;
    if (previous != null && prevVideoId !== videoId && hasLyricLines(useProjectStore.getState().lines)) {
      return loadVideoInNewProject(videoId, previous);
    }
    return loadVideoInPlace(videoId, previous);
  }, []);
}

function loadVideoInPlace(videoId: string, previous: AudioSource): Promise<void> {
  const prevVideoId = previous?.type === "youtube" ? previous.videoId : null;
  useAudioStore.getState().setYouTubeSource(videoId);

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
      if (!isYouTubeSourceFor(useAudioStore.getState().source, videoId)) return;
      if (clear) undoReset = resetSongIdentityForVideo(videoId, previous);
      else useProjectStore.getState().clearUnexportedImport();
    });
  }
  return loading.catch((error: unknown) => {
    undoReset?.();
    throw error;
  });
}

function resetSongIdentityForVideo(videoId: string, previous: AudioSource): () => void {
  const project = useProjectStore.getState();
  const { metadata, agents, hasUnexportedImport, importedMetadataKeys } = project;
  project.resetSongIdentity(videoId);
  const resetState = useProjectStore.getState();
  return () => {
    const current = useProjectStore.getState();
    const loadFellBackToPrevious = useAudioStore.getState().source === previous;
    const untouchedSinceReset =
      current.agents === resetState.agents &&
      shallow(withoutThumbnailOf(current.metadata, videoId), resetState.metadata);
    if (loadFellBackToPrevious && untouchedSinceReset) {
      current.restoreSongIdentity({ metadata, agents, hasUnexportedImport, importedMetadataKeys });
    }
  };
}

function isStillOnNewProject(newId: string): boolean {
  return openProjectIdSnapshot() === newId;
}

async function revertToPreviousProject(previousId: string | undefined, newId: string): Promise<void> {
  if (previousId !== undefined) {
    try {
      await openProject(previousId);
    } catch (error) {
      console.error(LOG_PREFIX, "could not switch back to the previous project", error);
    }
  }
  try {
    await deleteProject(newId);
  } catch (error) {
    console.error(LOG_PREFIX, "could not delete the abandoned project", error);
  }
}

async function loadVideoWithRollback(videoId: string, newId: string, previousId: string | undefined): Promise<void> {
  useAudioStore.getState().setYouTubeSource(videoId);
  try {
    await waitForYouTubeLoad(videoId);
  } catch (error) {
    if (!(error instanceof YouTubeLoadSupersededError) && isStillOnNewProject(newId)) {
      if (hasLyricLines(useProjectStore.getState().lines)) {
        useAudioStore.getState().setSource(null);
      } else {
        await revertToPreviousProject(previousId, newId);
      }
    }
    throw error;
  }
}

async function loadVideoInNewProject(videoId: string, previous: AudioSource): Promise<void> {
  const started = await startSongInNewProject(videoId, (song) =>
    loadVideoWithRollback(videoId, song.newId, song.previousId).then(() => song),
  );
  if (!started) return loadVideoInPlace(videoId, previous);
  showNewProjectToast(
    useProjectStore.getState().metadata.title,
    started.previousTitle,
    started.previousId,
    started.newId,
  );
}

function withoutThumbnailOf(metadata: ProjectMetadata, videoId: string): ProjectMetadata {
  if (metadata.thumbnailForVideoId !== videoId) return metadata;
  return { ...metadata, thumbnailDataUrl: undefined, thumbnailForVideoId: undefined };
}

function waitForYouTubeLoad(videoId: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const unsubscribe = useAudioStore.subscribe((state) => {
      if (hasLoadedYouTubeSourceFor(state.source, videoId)) {
        unsubscribe();
        resolve();
        return;
      }
      if (state.youtubeLoadError) {
        unsubscribe();
        reject(new YouTubeLoadFailedError(state.youtubeLoadError));
        return;
      }
      if (!isYouTubeSourceFor(state.source, videoId)) {
        unsubscribe();
        reject(new YouTubeLoadSupersededError());
      }
    });
  });
}

// -- Exports ------------------------------------------------------------------

export { useLoadYouTubeSource, loadVideoWithRollback, isYouTubeLoadError, isYouTubeLoadFailure, waitForYouTubeLoad };
