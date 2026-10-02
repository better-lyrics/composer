import { isLibrarySort } from "@/domain/project/library-order";
import { isLaunchScreen, isLibraryView } from "@/domain/project/library-preferences";
import { isKeepYouTubeAudio } from "@/domain/storage/audio-retention";
import { isStorageLimit } from "@/domain/storage/storage-limit";
import type { SettingsState } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

interface RetiredSettings {
  confirmReplaceProjectFromHash?: boolean;
}

// -- Constants ----------------------------------------------------------------

const SETTINGS_PERSIST_VERSION = 8;

// -- Migration ----------------------------------------------------------------

function migrateSettings(persistedState: unknown, version: number): unknown {
  if (!persistedState || typeof persistedState !== "object") return persistedState;
  const { confirmReplaceProjectFromHash: _retired, ...state } = persistedState as Partial<SettingsState> &
    RetiredSettings;
  const next: Partial<SettingsState> = { ...state };
  if (version < 2 || next.vocalModelVariant === "fp16") {
    next.vocalModelVariant = "fp32";
  }
  if (next.defaultRollingEdit === undefined) next.defaultRollingEdit = false;
  if (next.defaultPreviewSidebar === undefined) next.defaultPreviewSidebar = false;
  if (next.vocalOnsetSnap === undefined) next.vocalOnsetSnap = true;
  if (next.snapPlayheadToPoints === undefined) next.snapPlayheadToPoints = true;
  if (next.redoPreroll === undefined) next.redoPreroll = 1.5;
  // Old blobs carry an explicit false from before the default flipped, so an undefined guard never reaches them.
  if (version < 6) next.preserveBracketsOnExtraction = true;
  const { librarySort, libraryView, launchScreen, keepYouTubeAudio, smartCleanup, storageLimit, ...rest } = next;
  return {
    ...rest,
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
