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
  settingsScrollTop: number;
  settingsTarget: SettingsTarget | null;
  settingsReturnTo: HelpLocation | null;
  helpOpen: boolean;
  helpLocation: HelpLocation;
  projectSwitcherOpen: boolean;
}

interface UIActions {
  openSettings: (options?: OpenSettingsOptions) => void;
  closeSettings: () => void;
  setSettingsSection: (section: SettingsSectionId) => void;
  setSettingsQuery: (query: string) => void;
  consumeSettingsTarget: () => void;
  rememberSettingsScrollTop: (scrollTop: number) => void;
  openHelp: (section?: string) => void;
  closeHelp: () => void;
  rememberHelpLocation: (location: HelpLocation) => void;
  setProjectSwitcherOpen: (open: boolean) => void;
}

// -- Constants -----------------------------------------------------------------

const DEFAULT_HELP_SECTION = "getting-started";

const UI_INITIAL_STATE: UIState = {
  settingsOpen: false,
  settingsSection: "general",
  settingsQuery: "",
  settingsScrollTop: 0,
  settingsTarget: null,
  settingsReturnTo: null,
  helpOpen: false,
  helpLocation: { section: DEFAULT_HELP_SECTION, scrollTop: 0 },
  projectSwitcherOpen: false,
};

// -- Helpers -------------------------------------------------------------------

function sectionOfTarget(target: SettingsTarget): SettingsSectionId {
  return "setting" in target ? settingEntry(target.setting).section : target.section;
}

// -- Store ---------------------------------------------------------------------

const useUIStore = create<UIState & UIActions>((set, get) => ({
  ...UI_INITIAL_STATE,

  openSettings: ({ target, returnTo } = {}) =>
    set((state) => ({
      settingsOpen: true,
      ...(target ? { settingsSection: sectionOfTarget(target), settingsQuery: "", settingsScrollTop: 0 } : {}),
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
  rememberSettingsScrollTop: (settingsScrollTop) => set({ settingsScrollTop }),
  openHelp: (section) => set({ helpOpen: true, ...(section ? { helpLocation: { section, scrollTop: 0 } } : {}) }),
  closeHelp: () => set({ helpOpen: false }),
  rememberHelpLocation: (helpLocation) => {
    // Help also remounts while open when asked for another section; that request wins.
    if (!get().helpOpen) set({ helpLocation });
  },
  setProjectSwitcherOpen: (projectSwitcherOpen) => set({ projectSwitcherOpen }),
}));

// -- Exports -------------------------------------------------------------------

export { UI_INITIAL_STATE, useUIStore };
export type { HelpLocation, SettingsTarget };
