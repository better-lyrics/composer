import { useSettingsStore } from "@/stores/settings";
import type { SettingId } from "@/stores/settings-catalog";
import { BridgeSection } from "@/ui/settings/bridge-section";
import { CobaltInstancesSetting } from "@/ui/settings/cobalt-instances-setting";
import { DefaultPlaybackRateSetting } from "@/ui/settings/default-playback-rate-setting";
import type { SelectOption, SliderAction } from "@/ui/settings/setting-controls";
import { SplitCharacterSetting } from "@/ui/settings/split-character-setting";
import { ThemeSettings } from "@/ui/settings/theme/theme-settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";

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
const asMilliseconds = (seconds: number) => `${(seconds * 1000).toFixed(0)}ms`;

// -- Registry ------------------------------------------------------------------

const SETTING_CONTROLS: Record<SettingId, SettingControl> = {
  showShortcutHints: TOGGLE,
  showSyllableIndicators: TOGGLE,
  autoExtractBackgroundVocals: TOGGLE,
  mergeStandaloneBackgroundLines: TOGGLE,
  preserveBracketsOnExtraction: TOGGLE,
  theme: { kind: "custom", Component: ThemeSettings },
  defaultPlaybackRate: { kind: "custom", Component: DefaultPlaybackRateSetting },
  preservePitch: TOGGLE,
  rememberVolume: TOGGLE,
  audioScrubPreview: TOGGLE,
  autoSeparateOnImport: TOGGLE,
  vocalModelVariant: {
    kind: "select",
    options: [
      { value: "fp32", label: "fp32 (~171 MB, recommended)" },
      { value: "fp16", label: "fp16 (~85 MB, experimental)" },
    ],
  },
  defaultZoom: {
    kind: "slider",
    min: 20,
    max: 500,
    step: 20,
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
  timelineSnapThreshold: { kind: "slider", min: 4, max: 24, step: 1, format: (v) => `${v}px` },
  snapPlayheadToPoints: TOGGLE,
  followPlayhead: TOGGLE,
  defaultRollingEdit: TOGGLE,
  syllablesFollowRolling: TOGGLE,
  defaultPreviewSidebar: TOGGLE,
  timelineHorizontalScroll: TOGGLE,
  splitCharacter: { kind: "custom", Component: SplitCharacterSetting },
  nudgeAmount: { kind: "slider", min: 0.01, max: 0.2, step: 0.01, format: asMilliseconds },
  defaultWordDuration: { kind: "slider", min: 0.1, max: 1, step: 0.05, format: asMilliseconds },
  minWordDuration: { kind: "slider", min: 0.01, max: 0.2, step: 0.01, format: asMilliseconds },
  redoPreroll: { kind: "slider", min: 0, max: 5, step: 0.1, format: asMilliseconds },
  defaultGranularity: {
    kind: "select",
    options: [
      { value: "word", label: "Word" },
      { value: "line", label: "Line" },
    ],
  },
  confirmReplaceProjectFromHash: TOGGLE,
  confirmReplaceLyrics: TOGGLE,
  confirmSyncReset: TOGGLE,
  confirmClearProject: TOGGLE,
  confirmResetSettings: TOGGLE,
  confirmResetShortcuts: TOGGLE,
  confirmApplyToAllSyllableSplit: TOGGLE,
  confirmConformToGroup: TOGGLE,
  confirmGroupDissolution: TOGGLE,
  confirmClearImportedSongDetails: TOGGLE,
  autoSaveDelay: { kind: "slider", min: 500, max: 10000, step: 500, format: (v) => `${(v / 1000).toFixed(1)}s` },
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
