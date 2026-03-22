import { create } from "zustand";
import { persist } from "zustand/middleware";

// -- Types --------------------------------------------------------------------

type GranularityDefault = "word" | "line";
type SyncMethodDefault = "tap" | "hold";

interface SettingsState {
  defaultPlaybackRate: number;
  rememberVolume: boolean;
  lastVolume: number;

  defaultZoom: number;
  defaultRowHeight: number;
  followPlayhead: boolean;

  nudgeAmount: number;
  defaultWordDuration: number;
  minWordDuration: number;
  defaultGranularity: GranularityDefault;
  defaultSyncMethod: SyncMethodDefault;

  autoSaveDelay: number;

  showShortcutHints: boolean;
  showSyllableIndicators: boolean;
  splitCharacter: string;
}

interface SettingsActions {
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  resetToDefaults: () => void;
}

// -- Defaults -----------------------------------------------------------------

const DEFAULTS: SettingsState = {
  defaultPlaybackRate: 0.75,
  rememberVolume: true,
  lastVolume: 1,

  defaultZoom: 100,
  defaultRowHeight: 44,
  followPlayhead: true,

  nudgeAmount: 0.05,
  defaultWordDuration: 0.3,
  minWordDuration: 0.05,
  defaultGranularity: "word",
  defaultSyncMethod: "tap",

  autoSaveDelay: 2000,

  showShortcutHints: true,
  showSyllableIndicators: true,
  splitCharacter: "|",
};

// -- Store --------------------------------------------------------------------

const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      set: (key, value) => set({ [key]: value }),
      resetToDefaults: () => set(DEFAULTS),
    }),
    { name: "composer-settings" },
  ),
);

// -- Exports ------------------------------------------------------------------

export { useSettingsStore, DEFAULTS };
export type { SettingsState };
