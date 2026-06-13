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

interface AudioFieldsPatch {
  audioBytesCached: boolean;
  audioSource: SavedAudioSource | undefined;
}

// -- Save Lock ----------------------------------------------------------------

let saveLock: Promise<void> = Promise.resolve();

async function acquireSaveLock<T>(task: () => Promise<T>): Promise<T> {
  const previous = saveLock;
  let release!: () => void;
  saveLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

// -- Helpers ------------------------------------------------------------------

function toSavedAudioSource(source: AudioSource): SavedAudioSource | undefined {
  if (!source) return undefined;
  if (source.type === "file") return { kind: "file", name: source.file.name };
  if (source.type === "youtube") return { kind: "youtube", videoId: source.videoId };
  return undefined;
}

interface LiveStateSnapshot {
  id: string;
  metadata: LibraryProject["metadata"];
  agents: LibraryProject["agents"];
  lines: LibraryProject["lines"];
  groups: LibraryProject["groups"];
  granularity: LibraryProject["granularity"];
  syllableSplitDefaults: LibraryProject["syllableSplitDefaults"];
  dismissedSuggestions: string[];
  dismissedExplicitSuggestions: string[];
  currentStem: LibraryProject["currentStem"];
  primingStripped: boolean | undefined;
  audioSource: SavedAudioSource | undefined;
}

function snapshotLiveState(id: string): LiveStateSnapshot {
  const project = useProjectStore.getState();
  const audio = useAudioStore.getState();
  const separation = useSeparationStore.getState();
  return {
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
  };
}

function buildFreshRecord(snapshot: LiveStateSnapshot): LibraryProject {
  const now = Date.now();
  return {
    version: 1,
    id: snapshot.id,
    metadata: snapshot.metadata,
    agents: snapshot.agents,
    lines: snapshot.lines,
    groups: snapshot.groups,
    granularity: snapshot.granularity,
    syllableSplitDefaults: snapshot.syllableSplitDefaults,
    dismissedSuggestions: snapshot.dismissedSuggestions,
    dismissedExplicitSuggestions: snapshot.dismissedExplicitSuggestions,
    currentStem: snapshot.currentStem,
    primingStripped: snapshot.primingStripped,
    audioSource: snapshot.audioSource,
    audioBytesCached: false,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
}

function mergeSnapshot(snapshot: LiveStateSnapshot, previous: LibraryProject | undefined): LibraryProject {
  const base = previous ?? buildFreshRecord(snapshot);
  return {
    ...base,
    metadata: snapshot.metadata,
    agents: snapshot.agents,
    lines: snapshot.lines,
    groups: snapshot.groups,
    granularity: snapshot.granularity,
    syllableSplitDefaults: snapshot.syllableSplitDefaults,
    dismissedSuggestions: snapshot.dismissedSuggestions,
    dismissedExplicitSuggestions: snapshot.dismissedExplicitSuggestions,
    currentStem: snapshot.currentStem,
    primingStripped: snapshot.primingStripped,
    audioSource: snapshot.audioSource,
    updatedAt: Date.now(),
  };
}

// -- Public API ---------------------------------------------------------------

async function saveActiveProject(): Promise<void> {
  const id = useProjectStore.getState().activeProjectId;
  if (!id) return;
  const snapshot = snapshotLiveState(id);
  await acquireSaveLock(async () => {
    const previous = await getLibraryProject(id);
    await putLibraryProject(mergeSnapshot(snapshot, previous));
  });
}

async function saveActiveProjectAudio(file: File | null, deps: SaveDeps): Promise<void> {
  const id = useProjectStore.getState().activeProjectId;
  if (!id) return;
  const snapshot = snapshotLiveState(id);

  if (file === null) {
    await deps.audioBlobs.delete(id);
    await acquireSaveLock(() => applyAudioPatch(snapshot, { audioBytesCached: false, audioSource: undefined }));
    return;
  }

  const bytes = await file.arrayBuffer();
  await deps.audioBlobs.put(id, bytes);
  await acquireSaveLock(() => applyAudioPatch(snapshot, { audioBytesCached: true, audioSource: snapshot.audioSource }));
}

async function applyAudioPatch(snapshot: LiveStateSnapshot, patch: AudioFieldsPatch): Promise<void> {
  const previous = await getLibraryProject(snapshot.id);
  if (!previous) {
    const fresh = buildFreshRecord(snapshot);
    await putLibraryProject({ ...fresh, ...patch });
    return;
  }
  await putLibraryProject({ ...previous, ...patch, updatedAt: Date.now() });
}

// -- Exports ------------------------------------------------------------------

export { saveActiveProject, saveActiveProjectAudio };
export type { SaveDeps };
