import { BUILTIN_ALIGNMENT_MODEL, RECOMMENDED_ALIGNMENT_MODEL } from "@/audio/alignment/hubertfa/model-manifest";
import { isPitchLineMode } from "@/domain/pitch/pitch-line-mode";
import { isLibrarySort } from "@/domain/project/library-order";
import { isLaunchScreen, isLibraryView } from "@/domain/project/library-preferences";
import { sanitizeSpectrumSettings } from "@/domain/spectrum/settings";
import { isKeepYouTubeAudio } from "@/domain/storage/audio-retention";
import { isStorageLimit } from "@/domain/storage/storage-limit";
import type { SettingsState } from "@/stores/settings";
import { SNAP_DISTANCE_SETTING } from "@/stores/settings-snap";

// -- Types --------------------------------------------------------------------

interface RetiredSettings {
  confirmReplaceProjectFromHash?: boolean;
  defaultRollingEdit?: unknown;
  defaultPreviewSidebar?: unknown;
  timelineSnapThreshold?: unknown;
}

// -- Constants ----------------------------------------------------------------

const SETTINGS_PERSIST_VERSION = 15;

// -- Migration ----------------------------------------------------------------

function migrateSettings(persistedState: unknown, version: number): unknown {
  if (!persistedState || typeof persistedState !== "object") return persistedState;
  const {
    confirmReplaceProjectFromHash: _retired,
    defaultRollingEdit,
    defaultPreviewSidebar,
    timelineSnapThreshold,
    ...state
  } = persistedState as Partial<SettingsState> & RetiredSettings;
  const next: Partial<SettingsState> = { ...state };
  if (typeof defaultRollingEdit === "boolean") next.rollingEdit = defaultRollingEdit;
  if (typeof defaultPreviewSidebar === "boolean") next.previewSidebar = defaultPreviewSidebar;
  if (typeof timelineSnapThreshold === "number") {
    for (const key of Object.values(SNAP_DISTANCE_SETTING)) next[key] ??= timelineSnapThreshold;
  }
  if (next.rollingEdit === undefined) next.rollingEdit = false;
  if (next.previewSidebar === undefined) next.previewSidebar = false;
  if (version < 2 || next.vocalModelVariant === "fp16") {
    next.vocalModelVariant = "fp32";
  }
  if (next.vocalOnsetSnap === undefined) next.vocalOnsetSnap = true;
  if (next.snapPlayheadToPoints === undefined) next.snapPlayheadToPoints = true;
  if (next.redoPreroll === undefined) next.redoPreroll = 1.5;
  if (next.syncCountIn === undefined) next.syncCountIn = 3;
  if (next.selectionLeadIn === undefined) next.selectionLeadIn = 0.3;
  // Old blobs carry an explicit false from before the default flipped, so an undefined guard never reaches them.
  if (version < 6) next.preserveBracketsOnExtraction = true;
  // Before 9 every speed change was written into the default, so the default is the speed last used.
  if (version < 9 && next.lastPlaybackRate === undefined && typeof next.defaultPlaybackRate === "number") {
    next.lastPlaybackRate = next.defaultPlaybackRate;
  }
  // 5 was the default before 10, so a saved 5 is the old default, not a choice.
  if (version < 10 && next.seekStep === 5) next.seekStep = 0.5;
  if (version < 10 && typeof next.seekStep === "number" && next.seekStep > 5) next.seekStep = 5;
  // "always" was the default before 12, so a saved "always" is the old default, not a choice.
  if (version < 12 && next.pitchLine === "always") next.pitchLine = "off";
  // The built-in model was the default before 13, so a saved one is the old default, not a choice.
  if (version < 13 && next.alignmentModelId === BUILTIN_ALIGNMENT_MODEL.id) {
    next.alignmentModelId = RECOMMENDED_ALIGNMENT_MODEL;
  }
  const {
    librarySort,
    libraryView,
    launchScreen,
    keepYouTubeAudio,
    smartCleanup,
    storageLimit,
    pitchLine,
    showSpectrum,
    spectrumBandHeight,
    spectrumSource,
    spectrumPalette,
    spectrumContrast,
    spectrumScale,
    spectrumTop,
    spectrumWindow,
    spectrumPhase,
    ...rest
  } = next;
  return {
    ...rest,
    ...sanitizeSpectrumSettings({
      showSpectrum,
      spectrumBandHeight,
      spectrumSource,
      spectrumPalette,
      spectrumContrast,
      spectrumScale,
      spectrumTop,
      spectrumWindow,
      spectrumPhase,
    }),
    ...(isPitchLineMode(pitchLine) ? { pitchLine } : {}),
    ...(isLibrarySort(librarySort) ? { librarySort } : {}),
    ...(isLibraryView(libraryView) ? { libraryView } : {}),
    ...(isLaunchScreen(launchScreen) ? { launchScreen } : {}),
    ...(isKeepYouTubeAudio(keepYouTubeAudio) ? { keepYouTubeAudio } : {}),
    ...(typeof smartCleanup === "boolean" ? { smartCleanup } : {}),
    ...(isStorageLimit(storageLimit) ? { storageLimit } : {}),
  };
}

// -- Exports ------------------------------------------------------------------

export { SETTINGS_PERSIST_VERSION, migrateSettings };
