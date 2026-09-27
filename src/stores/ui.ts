import { type SettingId, type SettingsSectionId, settingEntry } from "@/stores/settings-catalog";
import { create } from "zustand";

// -- Types ---------------------------------------------------------------------

type SettingsTarget = { setting: SettingId } | { section: SettingsSectionId };

interface HelpLocation {
  section: string;
  scrollTop: number;
  query?: string;
}

interface OpenSettingsOptions {
  target?: SettingsTarget;
  returnTo?: HelpLocation;
}

interface UIState {
  settingsOpen: boolean;
  settingsSection: SettingsSectionId;
  settingsQuery: string;
  settingsTarget: SettingsTarget | null;
  settingsReturnTo: HelpLocation | null;
  helpOpen: boolean;
  helpLocation: HelpLocation;
}

interface UIActions {
  openSettings: (options?: OpenSettingsOptions) => void;
  closeSettings: () => void;
  setSettingsSection: (section: SettingsSectionId) => void;
  setSettingsQuery: (query: string) => void;
  consumeSettingsTarget: () => void;
  openHelp: (section?: string) => void;
  closeHelp: () => void;
}

// -- Constants -----------------------------------------------------------------

const DEFAULT_HELP_SECTION = "getting-started";

const UI_INITIAL_STATE: UIState = {
  settingsOpen: false,
  settingsSection: "general",
  settingsQuery: "",
  settingsTarget: null,
  settingsReturnTo: null,
  helpOpen: false,
  helpLocation: { section: DEFAULT_HELP_SECTION, scrollTop: 0 },
};

// -- Helpers -------------------------------------------------------------------

function sectionOfTarget(target: SettingsTarget): SettingsSectionId {
  return "setting" in target ? settingEntry(target.setting).section : target.section;
}

// -- Store ---------------------------------------------------------------------

const useUIStore = create<UIState & UIActions>((set) => ({
  ...UI_INITIAL_STATE,

  openSettings: ({ target, returnTo } = {}) =>
    set((state) => ({
      settingsOpen: true,
      settingsSection: target ? sectionOfTarget(target) : UI_INITIAL_STATE.settingsSection,
      settingsQuery: "",
      settingsTarget: target ?? null,
      settingsReturnTo: returnTo ?? (state.settingsOpen ? state.settingsReturnTo : null),
      helpOpen: returnTo ? false : state.helpOpen,
    })),
  closeSettings: () =>
    set((state) =>
      state.settingsReturnTo
        ? {
            settingsOpen: false,
            settingsTarget: null,
            settingsReturnTo: null,
            helpOpen: true,
            helpLocation: state.settingsReturnTo,
          }
        : { settingsOpen: false, settingsTarget: null },
    ),
  setSettingsSection: (settingsSection) => set({ settingsSection, settingsQuery: "" }),
  setSettingsQuery: (settingsQuery) => set({ settingsQuery }),
  consumeSettingsTarget: () => set({ settingsTarget: null }),
  openHelp: (section = DEFAULT_HELP_SECTION) => set({ helpOpen: true, helpLocation: { section, scrollTop: 0 } }),
  closeHelp: () => set({ helpOpen: false }),
}));

// -- Exports -------------------------------------------------------------------

export { UI_INITIAL_STATE, useUIStore };
export type { HelpLocation, SettingsTarget };
