import type { LibraryProject } from "@/domain/project/library-project";
import type { AudioBlobStore } from "@/lib/audio-blob-store";
import { getLibraryProject, putLibraryProject } from "@/lib/library-persistence";
import type { SavedAudioSource } from "@/lib/persistence";
import { type AudioSource, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";

// -- Types --------------------------------------------------------------------

interface SaveDeps {
  audioBlobs: AudioBlobStore;
}

// -- Helpers ------------------------------------------------------------------

function toSavedAudioSource(source: AudioSource): SavedAudioSource | undefined {
  if (!source) return undefined;
  if (source.type === "file") return { kind: "file", name: source.file.name };
  if (source.type === "youtube") return { kind: "youtube", videoId: source.videoId };
  return undefined;
}

function buildLibraryProject(id: string, previous: LibraryProject | undefined): LibraryProject {
  const project = useProjectStore.getState();
  const audio = useAudioStore.getState();
  const separation = useSeparationStore.getState();
  const now = Date.now();
  const base: LibraryProject = previous ?? {
    version: 1,
    id,
    metadata: project.metadata,
    agents: project.agents,
    lines: project.lines,
    groups: project.groups,
    granularity: project.granularity,
    syllableSplitDefaults: project.syllableSplitDefaults,
    dismissedSuggestions: project.dismissedSuggestions,
    dismissedExplicitSuggestions: project.dismissedExplicitSuggestions,
    currentStem: separation.currentStem,
    primingStripped: project.primingStripped,
    audioSource: toSavedAudioSource(audio.source),
    audioBytesCached: false,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };

  return {
    ...base,
    metadata: project.metadata,
    agents: project.agents,
    lines: project.lines,
    groups: project.groups,
    granularity: project.granularity,
    syllableSplitDefaults: project.syllableSplitDefaults,
    dismissedSuggestions: project.dismissedSuggestions,
    dismissedExplicitSuggestions: project.dismissedExplicitSuggestions,
    currentStem: separation.currentStem,
    primingStripped: project.primingStripped,
    audioSource: toSavedAudioSource(audio.source),
    updatedAt: now,
  };
}

// -- Public API ---------------------------------------------------------------

async function saveActiveProject(): Promise<void> {
  const id = useProjectStore.getState().activeProjectId;
  if (!id) return;
  const previous = await getLibraryProject(id);
  const project = buildLibraryProject(id, previous);
  await putLibraryProject(project);
}

async function saveActiveProjectAudio(file: File | null, deps: SaveDeps): Promise<void> {
  const id = useProjectStore.getState().activeProjectId;
  if (!id) return;
  const previous = await getLibraryProject(id);
  if (file === null) {
    await deps.audioBlobs.delete(id);
    const project = buildLibraryProject(id, previous);
    await putLibraryProject({ ...project, audioBytesCached: false });
    return;
  }
  const bytes = await file.arrayBuffer();
  await deps.audioBlobs.put(id, bytes);
  const project = buildLibraryProject(id, previous);
  await putLibraryProject({ ...project, audioBytesCached: true });
}

// -- Exports ------------------------------------------------------------------

export { saveActiveProject, saveActiveProjectAudio };
export type { SaveDeps };
