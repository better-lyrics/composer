import type { SavedAudioSource } from "@/domain/project/audio-source";
import { keepsYouTubeAudio } from "@/domain/storage/audio-retention";
import type { ProjectSaveInput } from "@/lib/persistence";
import { type AudioSource, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";

// -- Audio --------------------------------------------------------------------

function toSavedAudioSource(source: AudioSource): SavedAudioSource | undefined {
  if (!source) return undefined;
  if (source.type === "file") return { kind: "file", name: source.file.name };
  if (source.type === "youtube") return { kind: "youtube", videoId: source.videoId };
  return undefined;
}

function playableFile(source: AudioSource): File | null {
  if (!source) return null;
  if (source.type === "file") return source.file;
  if (source.type === "youtube") return source.file ?? null;
  return null;
}

function keepsYouTubeAudioNow(): boolean {
  const settings = useSettingsStore.getState();
  return keepsYouTubeAudio(settings.keepYouTubeAudio, settings.experiments.youtubeBridge);
}

function storedAudioFile(source: AudioSource): File | null {
  if (source?.type !== "youtube") return playableFile(source);
  return keepsYouTubeAudioNow() ? playableFile(source) : null;
}

function hadStoredAudio(source: AudioSource): boolean {
  return playableFile(source) !== null;
}

// -- Save input ---------------------------------------------------------------

function currentSaveInput(): ProjectSaveInput {
  const projectState = useProjectStore.getState();
  const audioState = useAudioStore.getState();
  return {
    metadata: projectState.metadata,
    agents: projectState.agents,
    lines: projectState.lines,
    groups: projectState.groups,
    granularity: projectState.granularity,
    exportTiming: projectState.exportTiming,
    syllableSplitDefaults: projectState.syllableSplitDefaults,
    audioSource: toSavedAudioSource(audioState.source) ?? audioState.expectedAudio ?? undefined,
    dismissedSuggestions: projectState.dismissedSuggestions,
    dismissedExplicitSuggestions: projectState.dismissedExplicitSuggestions,
    currentStem: useSeparationStore.getState().currentStem,
    primingStripped: projectState.primingStripped,
    customSnapPoints: projectState.customSnapPoints,
    hasUnexportedImport: projectState.hasUnexportedImport,
    importedMetadataKeys: projectState.importedMetadataKeys,
    ttmlEditState: projectState.ttmlEditState,
  };
}

function buildSaveInput(): ProjectSaveInput | null {
  const projectState = useProjectStore.getState();
  const audioState = useAudioStore.getState();
  // An audio-only session still saves: the stem and the audio source kind must survive a reload.
  const hasContent = projectState.lines.length > 0 || projectState.metadata.title;
  if (!hasContent && audioState.source === null && audioState.expectedAudio === null) return null;
  return currentSaveInput();
}

// -- Exports ------------------------------------------------------------------

export { storedAudioFile, hadStoredAudio, buildSaveInput, currentSaveInput };
