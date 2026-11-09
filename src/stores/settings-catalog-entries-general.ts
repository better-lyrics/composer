import type { SettingEntry } from "@/stores/settings-catalog";

// -- Catalog ------------------------------------------------------------------

const GENERAL_CATALOG_ENTRIES = {
  showShortcutHints: {
    section: "general",
    label: "Show shortcut hints",
    description: "Display keyboard shortcut badges on toolbar buttons.",
    keywords: ["badges", "keys", "hotkeys"],
    settingKey: "showShortcutHints",
  },
  showGuide: {
    section: "general",
    label: "Show the guide",
    description: "A small corner guide with your next step and tips for what you're doing.",
    keywords: ["guide", "tips", "hints", "medals"],
    settingKey: "showGuide",
  },
  musicBrainzLookup: {
    section: "general",
    label: "Song details from MusicBrainz",
    descriptionFor: (state) =>
      state.musicBrainzLookup === "off"
        ? "Composer never contacts MusicBrainz."
        : "Suggests album, ISRC, artists and songwriters in Export. Nothing is filled until you confirm.",
    keywords: ["metadata", "isrc", "songwriters", "album", "lookup"],
    settingKey: "musicBrainzLookup",
  },
  launchScreen: {
    section: "general",
    group: "Library",
    label: "On launch",
    description: "What Composer shows when you open it.",
    settingKey: "launchScreen",
  },
  libraryView: {
    section: "general",
    group: "Library",
    label: "Library view",
    description: "How the Projects page shows your songs. The toggle on that page changes this too.",
    settingKey: "libraryView",
  },
  librarySort: {
    section: "general",
    group: "Library",
    label: "Default sort",
    description: "The order projects appear in when you open Projects.",
    settingKey: "librarySort",
  },
  resetTour: {
    section: "general",
    group: "Reset",
    label: "Reset product tour",
    description: "Start the guided walkthrough from the first step the next time you open it.",
    keywords: ["tour", "walkthrough", "onboarding", "guide"],
  },
  resetGuide: {
    section: "general",
    group: "Reset",
    label: "Start the guide over",
    description: "Forget what the guide has seen you learn and bring back tips you turned off.",
    keywords: ["guide", "tips", "medals", "progress"],
  },
  resetAllSettings: {
    section: "general",
    group: "Reset",
    label: "Reset to defaults",
    description: "Restore all settings to their original values.",
    keywords: ["reset", "defaults", "restore"],
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { GENERAL_CATALOG_ENTRIES };
