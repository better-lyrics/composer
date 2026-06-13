import { useCallback } from "react";
import { audioBlobs } from "@/lib/audio-blob-store-singleton";
import { createProjectFromAudio } from "@/lib/create-project";
import { getLibraryProject } from "@/lib/library-persistence";
import { openLibraryProject } from "@/lib/library-resume";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";

// -- Hook ---------------------------------------------------------------------

function useLoadYouTubeSource(): (videoId: string) => Promise<void> {
  return useCallback(async (videoId: string) => {
    const alreadyActiveForVideo = await isVideoIdAlreadyActive(videoId);
    if (!alreadyActiveForVideo) {
      const id = await createProjectFromAudio({ kind: "youtube", videoId }, { audioBlobs });
      await openLibraryProject(id, { audioBlobs });
      useUIStore.getState().setViewingLibrary(false);
    } else {
      useAudioStore.getState().setYouTubeSource(videoId);
    }

    return waitForYouTubeLoad(videoId);
  }, []);
}

async function isVideoIdAlreadyActive(videoId: string): Promise<boolean> {
  const activeId = useProjectStore.getState().activeProjectId;
  if (!activeId) return false;
  const project = await getLibraryProject(activeId);
  return project?.audioSource?.kind === "youtube" && project.audioSource.videoId === videoId;
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
