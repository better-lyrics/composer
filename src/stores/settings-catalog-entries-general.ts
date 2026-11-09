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
  guideHints: {
    section: "general",
    label: "Show hints while you work",
    description: "Do something the slow way and the guide shows the faster way once, next to the control.",
    keywords: ["guide", "hints", "nudges", "popups"],
    settingKey: "guideHints",
    visibleWhen: (state) => state.showGuide,
  },
  unmuteGuideHints: {
    section: "general",
    label: "Hints you turned off",
    description: "Hints you stopped from the guide stay off until you turn them back on here.",
    keywords: ["guide", "hints", "muted", "unmute"],
    visibleWhen: (state) => state.showGuide && state.guideHints,
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
  resetGuide: {
    section: "general",
    group: "Reset",
    label: "Start the guide over",
    description: "Forget what the guide has seen you learn, so every tip and medal starts fresh.",
    keywords: ["guide", "tips", "medals", "progress", "onboarding"],
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
