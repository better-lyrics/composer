import type { LibrarySort } from "@/domain/project/library-order";
import type { LaunchScreen, LibraryView } from "@/domain/project/library-preferences";
import type { KeepYouTubeAudio } from "@/domain/storage/audio-retention";
import type { StorageLimit } from "@/domain/storage/storage-limit";
import { SETTINGS_PERSIST_VERSION, migrateSettings } from "@/stores/settings-migration";
import { DEFAULT_BRIDGE_URL } from "@/utils/composer-bridge-api";
import { PREVIEW_SIDEBAR_WIDTH } from "@/utils/preview-sidebar-width";
import { DEFAULT_MIN_WORD_DURATION } from "@/utils/word-spaces";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// -- Types --------------------------------------------------------------------

type GranularityDefault = "word" | "line";
type LinkedDivergenceAction = "ask" | "apply" | "detach";
type PreviewRenderer = "braccato" | "am-lyrics";
type VocalModelVariant = "fp16" | "fp32";

interface ExperimentFlags {
  youtubeBridge: boolean;
}

interface CobaltInstance {
  id: string;
  label: string;
  url: string;
}

interface CobaltInstanceStatus {
  status: "success" | "error";
  errorMessage?: string;
  at: number;
}

const DEFAULT_COBALT_INSTANCE_ID = "default";

interface SettingsState {
  defaultPlaybackRate: number;
  preservePitch: boolean;
  rememberVolume: boolean;
  lastVolume: number;
  audioScrubPreview: boolean;

  defaultZoom: number;
  defaultRowHeight: number;
  followPlayhead: boolean;
  defaultRollingEdit: boolean;
  defaultPreviewSidebar: boolean;
  previewSidebarWidth: number;
  timelineSnap: boolean;
  timelineSnapThreshold: number;
  vocalOnsetSnap: boolean;
  shareTimingInNewGroups: boolean;
  snapPlayheadToPoints: boolean;
  syllablesFollowRolling: boolean;
  timelineHorizontalScroll: boolean;

  nudgeAmount: number;
  defaultWordDuration: number;
  minWordDuration: number;
  redoPreroll: number;
  defaultGranularity: GranularityDefault;

  autoSaveDelay: number;
  keepYouTubeAudio: KeepYouTubeAudio;
  smartCleanup: boolean;
  storageLimit: StorageLimit;

  libraryView: LibraryView;
  librarySort: LibrarySort;
  launchScreen: LaunchScreen;

  showShortcutHints: boolean;
  showSyllableIndicators: boolean;
  splitCharacter: string;
  autoExtractBackgroundVocals: boolean;
  mergeStandaloneBackgroundLines: boolean;
  preserveBracketsOnExtraction: boolean;

  confirmReplaceLyrics: boolean;
  confirmSyncReset: boolean;
  confirmClearProject: boolean;
  confirmResetSettings: boolean;
  confirmResetShortcuts: boolean;
  confirmGroupDissolution: boolean;
  confirmApplyToAllSyllableSplit: boolean;
  confirmConformToGroup: boolean;
  confirmClearImportedSongDetails: boolean;
  linkedDivergenceAction: LinkedDivergenceAction;

  previewRenderer: PreviewRenderer;

  autoSeparateOnImport: boolean;
  vocalModelVariant: VocalModelVariant;

  cobaltInstances: CobaltInstance[];
  selectedCobaltInstanceId: string;
  cobaltInstanceStatus: Record<string, CobaltInstanceStatus>;

  experiments: ExperimentFlags;
  composerBridgeUrl: string;
}

interface SettingsActions {
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  resetToDefaults: () => void;
  addCobaltInstance: (instance: Omit<CobaltInstance, "id">) => void;
  updateCobaltInstance: (id: string, updates: Partial<Omit<CobaltInstance, "id">>) => void;
  removeCobaltInstance: (id: string) => void;
  selectCobaltInstance: (id: string) => void;
  recordCobaltInstanceResult: (id: string, status: "success" | "error", errorMessage?: string) => void;
}

// -- Defaults -----------------------------------------------------------------

const DEFAULTS: SettingsState = {
  defaultPlaybackRate: 0.75,
  preservePitch: true,
  rememberVolume: true,
  lastVolume: 1,
  audioScrubPreview: true,

  defaultZoom: 100,
  defaultRowHeight: 44,
  followPlayhead: true,
  defaultRollingEdit: false,
  defaultPreviewSidebar: false,
  previewSidebarWidth: PREVIEW_SIDEBAR_WIDTH.default,
  timelineSnap: true,
  timelineSnapThreshold: 12,
  vocalOnsetSnap: true,
  shareTimingInNewGroups: true,
  snapPlayheadToPoints: true,
  syllablesFollowRolling: false,
  timelineHorizontalScroll: false,

  nudgeAmount: 0.05,
  defaultWordDuration: 0.3,
  minWordDuration: DEFAULT_MIN_WORD_DURATION,
  redoPreroll: 1.5,
  defaultGranularity: "word",

  autoSaveDelay: 2000,
  keepYouTubeAudio: "auto",
  smartCleanup: true,
  storageLimit: "2gb",

  libraryView: "list",
  librarySort: "edited",
  launchScreen: "projects",

  showShortcutHints: true,
  showSyllableIndicators: true,
  splitCharacter: "|",
  autoExtractBackgroundVocals: true,
  mergeStandaloneBackgroundLines: true,
  preserveBracketsOnExtraction: true,

  confirmReplaceLyrics: true,
  confirmSyncReset: true,
  confirmClearProject: true,
  confirmResetSettings: true,
  confirmResetShortcuts: true,
  confirmGroupDissolution: true,
  confirmApplyToAllSyllableSplit: true,
  confirmConformToGroup: true,
  confirmClearImportedSongDetails: true,
  linkedDivergenceAction: "ask",

  previewRenderer: "braccato",

  autoSeparateOnImport: false,
  vocalModelVariant: "fp32",

  cobaltInstances: [],
  selectedCobaltInstanceId: DEFAULT_COBALT_INSTANCE_ID,
  cobaltInstanceStatus: {},

  experiments: { youtubeBridge: false },
  composerBridgeUrl: DEFAULT_BRIDGE_URL,
};

const BUILTIN_COBALT_INSTANCE: CobaltInstance = {
  id: DEFAULT_COBALT_INSTANCE_ID,
  label: "Composer",
  url: "https://cobalt.boidu.dev",
};

// -- Store --------------------------------------------------------------------

const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      set: (key, value) => set({ [key]: value }),
      resetToDefaults: () =>
        set((state) => ({
          ...DEFAULTS,
          confirmReplaceLyrics: state.confirmReplaceLyrics,
          confirmSyncReset: state.confirmSyncReset,
          confirmClearProject: state.confirmClearProject,
          confirmResetSettings: state.confirmResetSettings,
          confirmResetShortcuts: state.confirmResetShortcuts,
          confirmGroupDissolution: state.confirmGroupDissolution,
          confirmApplyToAllSyllableSplit: state.confirmApplyToAllSyllableSplit,
          confirmConformToGroup: state.confirmConformToGroup,
          confirmClearImportedSongDetails: state.confirmClearImportedSongDetails,
          linkedDivergenceAction: state.linkedDivergenceAction,
          cobaltInstances: state.cobaltInstances,
          selectedCobaltInstanceId: state.selectedCobaltInstanceId,
          cobaltInstanceStatus: state.cobaltInstanceStatus,
          experiments: state.experiments,
          composerBridgeUrl: state.composerBridgeUrl,
        })),
      addCobaltInstance: (instance) =>
        set((state) => {
          const id = crypto.randomUUID();
          return { cobaltInstances: [...state.cobaltInstances, { ...instance, id }] };
        }),
      updateCobaltInstance: (id, updates) =>
        set((state) => ({
          cobaltInstances: state.cobaltInstances.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      removeCobaltInstance: (id) =>
        set((state) => {
          const nextStatus = { ...state.cobaltInstanceStatus };
          delete nextStatus[id];
          return {
            cobaltInstances: state.cobaltInstances.filter((i) => i.id !== id),
            selectedCobaltInstanceId:
              state.selectedCobaltInstanceId === id ? DEFAULT_COBALT_INSTANCE_ID : state.selectedCobaltInstanceId,
            cobaltInstanceStatus: nextStatus,
          };
        }),
      selectCobaltInstance: (id) => set({ selectedCobaltInstanceId: id }),
      recordCobaltInstanceResult: (id, status, errorMessage) =>
        set((state) => ({
          cobaltInstanceStatus: {
            ...state.cobaltInstanceStatus,
            [id]: { status, errorMessage, at: Date.now() },
          },
        })),
    }),
    { name: "composer-settings", version: SETTINGS_PERSIST_VERSION, migrate: migrateSettings },
  ),
);

function getActiveCobaltInstance(): CobaltInstance {
  const state = useSettingsStore.getState();
  if (state.selectedCobaltInstanceId === DEFAULT_COBALT_INSTANCE_ID) return BUILTIN_COBALT_INSTANCE;
  const found = state.cobaltInstances.find((i) => i.id === state.selectedCobaltInstanceId);
  return found ?? BUILTIN_COBALT_INSTANCE;
}

function isUsingDefaultCobaltInstance(): boolean {
  const state = useSettingsStore.getState();
  if (state.selectedCobaltInstanceId === DEFAULT_COBALT_INSTANCE_ID) return true;
  return !state.cobaltInstances.some((i) => i.id === state.selectedCobaltInstanceId);
}

// -- Exports ------------------------------------------------------------------

export {
  useSettingsStore,
  DEFAULTS,
  BUILTIN_COBALT_INSTANCE,
  DEFAULT_COBALT_INSTANCE_ID,
  getActiveCobaltInstance,
  isUsingDefaultCobaltInstance,
};
export type { SettingsState, CobaltInstanceStatus, VocalModelVariant };
