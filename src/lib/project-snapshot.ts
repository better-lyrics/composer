import type { SavedAudioSource } from "@/domain/project/audio-source";
import { keepsYouTubeAudio } from "@/domain/storage/audio-retention";
import type { ProjectSaveInput } from "@/lib/persistence";
import type { IndexViewFields } from "@/lib/project-index-write";
import { type AudioSource, playableFile, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Audio --------------------------------------------------------------------

function toSavedAudioSource(source: AudioSource): SavedAudioSource | undefined {
  if (!source) return undefined;
  if (source.type === "file") return { kind: "file", name: source.file.name };
  if (source.type === "youtube") return { kind: "youtube", videoId: source.videoId, details: source.details };
  return undefined;
}

// The open project's audio, falling back to the audio it expects while that is not loaded.
function projectAudioSource(state: {
  source: AudioSource;
  expectedAudio: SavedAudioSource | null;
}): SavedAudioSource | undefined {
  return toSavedAudioSource(state.source) ?? state.expectedAudio ?? undefined;
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
    audioSource: projectAudioSource(audioState),
    dismissedSuggestions: projectState.dismissedSuggestions,
    dismissedExplicitSuggestions: projectState.dismissedExplicitSuggestions,
    dismissedMetadataMatches: projectState.dismissedMetadataMatches,
    currentStem: useSeparationStore.getState().currentStem,
    primingStripped: projectState.primingStripped,
    primingCorrected: projectState.primingCorrected,
    customSnapPoints: projectState.customSnapPoints,
    beatGrid: projectState.beatGrid,
    hasUnexportedImport: projectState.hasUnexportedImport,
    importedMetadataKeys: projectState.importedMetadataKeys,
    ttmlEditState: projectState.ttmlEditState,
    alignedTimings: projectState.alignedTimings,
    alignmentNoticeDismissed: projectState.alignmentNoticeDismissed,
  };
}

function openProjectView(): IndexViewFields {
  return { lastTab: useProjectStore.getState().activeTab, textVariant: useTimelineStore.getState().textVariant };
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

export { storedAudioFile, hadStoredAudio, buildSaveInput, currentSaveInput, openProjectView, projectAudioSource };
