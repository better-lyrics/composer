import { VOCAL_MODEL_APPROX_BYTES } from "@/audio/separation/model-registry";
import { SPECTRUM_CONTRAST } from "@/domain/spectrum/settings";
import { useSettingsStore } from "@/stores/settings";
import type { SettingId } from "@/stores/settings-catalog";
import { SNAP_DISTANCE_RANGE_PX } from "@/stores/settings-snap";
import { BEAT_GRID_LINE_OPTIONS } from "@/ui/beat-grid-line-options";
import { LAUNCH_SCREEN_OPTIONS, LIBRARY_SORT_OPTIONS } from "@/ui/projects/library-options";
import { AlignmentModelSetting } from "@/ui/settings/alignment-model-setting";
import { BridgeSection } from "@/ui/settings/bridge-section";
import { CobaltInstancesSetting } from "@/ui/settings/cobalt-instances-setting";
import { DefaultPlaybackRateSetting } from "@/ui/settings/default-playback-rate-setting";
import { LibraryViewSetting } from "@/ui/settings/library-view-setting";
import { LoupeSizeSetting } from "@/ui/settings/loupe-size/loupe-size-setting";
import { ResetAllSettingsSetting, ResetTourSetting } from "@/ui/settings/reset-settings";
import type { SelectOption } from "@/ui/select";
import type { SliderAction } from "@/ui/settings/setting-controls";
import { SplitCharacterSetting } from "@/ui/settings/split-character-setting";
import { BackUpAllProjectsSetting, DeleteAllProjectsSetting } from "@/ui/settings/storage/backup-settings-setting";
import { ProjectAudioListSetting } from "@/ui/settings/storage/project-audio-list-setting";
import { KEEP_YOUTUBE_AUDIO_OPTIONS, STORAGE_LIMIT_OPTIONS } from "@/ui/settings/storage/storage-options";
import { StorageProtectionSetting } from "@/ui/settings/storage/storage-protection-setting";
import { StorageUsageSetting } from "@/ui/settings/storage/storage-usage-setting";
import { ThemeSettings } from "@/ui/settings/theme/theme-settings";
import {
  ANALYSIS_WINDOW_OPTIONS,
  FREQUENCY_SCALE_OPTIONS,
  PHASE_COLOUR_OPTIONS,
  PITCH_LINE_OPTIONS,
  SPECTRUM_PALETTE_OPTIONS,
  SPECTRUM_SOURCE_OPTIONS,
  SPECTRUM_TOP_OPTIONS,
} from "@/ui/spectrum-options";
import { formatWholeMegabytes } from "@/utils/format-file-size";
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types ---------------------------------------------------------------------

type SettingControl =
  | { kind: "toggle" }
  | {
      kind: "slider";
      min: number;
      max: number;
      step: number;
      format?: (value: number) => string;
      action?: SliderAction;
    }
  | { kind: "select"; options: SelectOption[] }
  | { kind: "custom"; Component: React.FC };

// -- Formats -------------------------------------------------------------------

const TOGGLE: SettingControl = { kind: "toggle" };
const SNAP_DISTANCE: SettingControl = { kind: "slider", ...SNAP_DISTANCE_RANGE_PX, step: 1, format: (v) => `${v}px` };
const asMilliseconds = (seconds: number) => `${(seconds * 1000).toFixed(0)}ms`;

// -- Registry ------------------------------------------------------------------

const SETTING_CONTROLS: Record<SettingId, SettingControl> = {
  showShortcutHints: TOGGLE,
  showSyllableIndicators: TOGGLE,
  autoExtractBackgroundVocals: TOGGLE,
  mergeStandaloneBackgroundLines: TOGGLE,
  preserveBracketsOnExtraction: TOGGLE,
  musicBrainzLookup: {
    kind: "select",
    options: [
      { value: "auto", label: "Automatic" },
      { value: "manual", label: "On request" },
      { value: "off", label: "Off" },
    ],
  },
  resetTour: { kind: "custom", Component: ResetTourSetting },
  resetAllSettings: { kind: "custom", Component: ResetAllSettingsSetting },
  libraryView: { kind: "custom", Component: LibraryViewSetting },
  librarySort: { kind: "select", options: LIBRARY_SORT_OPTIONS },
  launchScreen: { kind: "select", options: LAUNCH_SCREEN_OPTIONS },
  theme: { kind: "custom", Component: ThemeSettings },
  defaultPlaybackRate: { kind: "custom", Component: DefaultPlaybackRateSetting },
  preservePitch: TOGGLE,
  rememberPlaybackRate: TOGGLE,
  rememberVolume: TOGGLE,
  audioScrubPreview: TOGGLE,
  autoSeparateOnImport: TOGGLE,
  vocalModelVariant: {
    kind: "select",
    options: [
      {
        value: "fp16",
        label: "fp16",
        badge: "Recommended",
        detail: `${formatWholeMegabytes(VOCAL_MODEL_APPROX_BYTES.fp16)} · Uses fp32 without WebGPU shader-f16`,
      },
      {
        value: "fp32",
        label: "fp32",
        detail: `${formatWholeMegabytes(VOCAL_MODEL_APPROX_BYTES.fp32)} · Full precision`,
      },
    ],
  },
  alignmentModelId: { kind: "custom", Component: AlignmentModelSetting },
  keepAlignmentModelLoaded: TOGGLE,
  defaultZoom: {
    kind: "slider",
    min: MIN_ZOOM,
    max: MAX_ZOOM,
    step: ZOOM_STEP,
    format: (v) => `${v} px/s`,
    action: {
      label: "Use current",
      onClick: () => useSettingsStore.getState().set("defaultZoom", useTimelineStore.getState().zoom),
    },
  },
  defaultRowHeight: {
    kind: "slider",
    min: 32,
    max: 120,
    step: 4,
    format: (v) => `${v}px`,
    action: {
      label: "Use current",
      onClick: () => useSettingsStore.getState().set("defaultRowHeight", useTimelineStore.getState().defaultRowHeight),
    },
  },
  timelineSnap: TOGGLE,
  vocalOnsetSnap: TOGGLE,
  snapWordsAndLines: TOGGLE,
  snapMarkers: TOGGLE,
  beatSnap: TOGGLE,
  snapToPlayhead: TOGGLE,
  beatGridVisible: TOGGLE,
  beatGridLines: { kind: "select", options: [...BEAT_GRID_LINE_OPTIONS] },
  shareTimingInNewGroups: TOGGLE,
  loopOpenGroup: TOGGLE,
  selectionLeadIn: { kind: "slider", min: 0, max: 1, step: 0.05, format: (v) => (v === 0 ? "Off" : asMilliseconds(v)) },
  snapDistanceWords: SNAP_DISTANCE,
  snapDistanceMarkers: SNAP_DISTANCE,
  snapDistanceOnsets: SNAP_DISTANCE,
  snapDistanceBeats: SNAP_DISTANCE,
  snapDistancePlayhead: SNAP_DISTANCE,
  snapPlayheadToPoints: TOGGLE,
  followPlayhead: TOGGLE,
  returnToCue: TOGGLE,
  rollingEdit: TOGGLE,
  syllablesFollowRolling: TOGGLE,
  previewSidebar: TOGGLE,
  timelineHorizontalScroll: TOGGLE,
  pitchLine: { kind: "select", options: [...PITCH_LINE_OPTIONS] },
  showSpectrum: TOGGLE,
  spectrumSource: { kind: "select", options: [...SPECTRUM_SOURCE_OPTIONS] },
  spectrumPalette: { kind: "select", options: [...SPECTRUM_PALETTE_OPTIONS] },
  spectrumContrast: {
    kind: "slider",
    min: SPECTRUM_CONTRAST.min,
    max: SPECTRUM_CONTRAST.max,
    step: 1,
    format: (v) => `${v} dB`,
  },
  spectrumScale: { kind: "select", options: [...FREQUENCY_SCALE_OPTIONS] },
  spectrumTop: { kind: "select", options: [...SPECTRUM_TOP_OPTIONS] },
  spectrumWindow: { kind: "select", options: [...ANALYSIS_WINDOW_OPTIONS] },
  loupeSize: { kind: "custom", Component: LoupeSizeSetting },
  spectrumPhase: { kind: "select", options: [...PHASE_COLOUR_OPTIONS] },
  splitCharacter: { kind: "custom", Component: SplitCharacterSetting },
  nudgeAmount: { kind: "slider", min: 0.01, max: 0.2, step: 0.01, format: asMilliseconds },
  defaultWordDuration: { kind: "slider", min: 0.1, max: 1, step: 0.05, format: asMilliseconds },
  minWordDuration: { kind: "slider", min: 0.01, max: 0.2, step: 0.01, format: asMilliseconds },
  redoPreroll: { kind: "slider", min: 0, max: 5, step: 0.1, format: asMilliseconds },
  seekStep: { kind: "slider", min: 0.1, max: 5, step: 0.1, format: (v) => `${v.toFixed(1)}s` },
  fineSeekStep: { kind: "slider", min: 0.01, max: 0.5, step: 0.01, format: asMilliseconds },
  syncCountIn: { kind: "slider", min: 0, max: 10, step: 1, format: (v) => (v === 0 ? "Off" : `${v}s`) },
  defaultGranularity: {
    kind: "select",
    options: [
      { value: "word", label: "Word" },
      { value: "line", label: "Line" },
    ],
  },
  confirmReplaceLyrics: TOGGLE,
  confirmSyncReset: TOGGLE,
  confirmClearProject: TOGGLE,
  confirmResetSettings: TOGGLE,
  confirmResetShortcuts: TOGGLE,
  confirmApplyToAllSyllableSplit: TOGGLE,
  confirmConformToGroup: TOGGLE,
  confirmGroupDissolution: TOGGLE,
  confirmClearImportedSongDetails: TOGGLE,
  storageUsage: { kind: "custom", Component: StorageUsageSetting },
  storageProtection: { kind: "custom", Component: StorageProtectionSetting },
  keepYouTubeAudio: { kind: "select", options: KEEP_YOUTUBE_AUDIO_OPTIONS },
  smartCleanup: TOGGLE,
  storageLimit: { kind: "select", options: STORAGE_LIMIT_OPTIONS },
  projectAudioList: { kind: "custom", Component: ProjectAudioListSetting },
  autoSaveDelay: { kind: "slider", min: 500, max: 10000, step: 500, format: (v) => `${(v / 1000).toFixed(1)}s` },
  backUpAllProjects: { kind: "custom", Component: BackUpAllProjectsSetting },
  deleteAllProjects: { kind: "custom", Component: DeleteAllProjectsSetting },
  previewRenderer: {
    kind: "select",
    options: [
      { value: "braccato", label: "Braccato (default)" },
      { value: "am-lyrics", label: "am-lyrics" },
    ],
  },
  youtubeBridge: { kind: "custom", Component: BridgeSection },
  cobaltInstances: { kind: "custom", Component: CobaltInstancesSetting },
};

// -- Exports -------------------------------------------------------------------

export { SETTING_CONTROLS };
