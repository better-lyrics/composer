import type { AudioBlobStore } from "@/lib/audio-blob-store";
import { getLibraryProject } from "@/lib/library-persistence";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";

// -- Types --------------------------------------------------------------------

interface ResumeDeps {
  audioBlobs: AudioBlobStore;
}

// -- Helpers ------------------------------------------------------------------

function resolveAudioName(loaded: NonNullable<Awaited<ReturnType<typeof getLibraryProject>>>): string {
  if (loaded.audioSource?.kind === "file") return loaded.audioSource.name;
  if (loaded.audioSource?.kind === "youtube") return `${loaded.audioSource.videoId}.opus`;
  return "audio.bin";
}

async function restoreAudioForProject(projectId: string, deps: ResumeDeps): Promise<void> {
  const loaded = await getLibraryProject(projectId);
  if (!loaded) return;

  if (loaded.currentStem) {
    useSeparationStore.getState().restoreCurrentStem(loaded.currentStem);
  }

  if (loaded.audioBytesCached) {
    const bytes = await deps.audioBlobs.get(projectId);
    if (bytes) {
      const file = new File([bytes], resolveAudioName(loaded));
      if (loaded.audioSource?.kind === "youtube") {
        useAudioStore.getState().setYouTubeSource(loaded.audioSource.videoId, file);
      } else {
        useAudioStore.getState().setSource({ type: "file", file });
      }
      return;
    }
  }

  if (loaded.audioSource?.kind === "youtube") {
    useAudioStore.getState().setYouTubeSource(loaded.audioSource.videoId);
  }
}

async function openLibraryProject(id: string, deps: ResumeDeps): Promise<void> {
  await useProjectStore.getState().setActiveProject(id, deps);
  await restoreAudioForProject(id, deps);
}

// -- Exports ------------------------------------------------------------------

export { openLibraryProject, restoreAudioForProject };
export type { ResumeDeps };
