import type { SettingEntry } from "@/stores/settings-catalog";

// -- Catalog ------------------------------------------------------------------

const CONFIRMATIONS_CATALOG_ENTRIES = {
  confirmReplaceLyrics: {
    section: "confirmations",
    group: "Lyrics",
    label: "Confirm replacing lyrics on import",
    description: "Show a warning when importing lyrics into a project that already has lines.",
    settingKey: "confirmReplaceLyrics",
  },
  confirmApplyToAllSyllableSplit: {
    section: "confirmations",
    group: "Lyrics",
    label: "Confirm before splitting multiple identical words",
    description: "Show a warning when a syllable split would also apply to other identical words across the project.",
    settingKey: "confirmApplyToAllSyllableSplit",
  },
  confirmClearImportedSongDetails: {
    section: "confirmations",
    group: "Lyrics",
    label: "Confirm clearing imported song details",
    description: "Show a warning before a new song clears imported details you have not exported.",
    settingKey: "confirmClearImportedSongDetails",
  },
  linkedDivergenceAction: {
    section: "confirmations",
    group: "Groups",
    label: "When linked lines change words",
    description: "What happens to a group's other lines when you add or remove words in one of them.",
    keywords: ["word structure changed", "apply to all", "detach", "don't ask again", "linked"],
    settingKey: "linkedDivergenceAction",
  },
  confirmConformToGroup: {
    section: "confirmations",
    group: "Groups",
    label: "Confirm conforming lines to a group",
    description: "Show a warning before existing lines take on a group's text and timing.",
    settingKey: "confirmConformToGroup",
  },
  confirmGroupDissolution: {
    section: "confirmations",
    group: "Groups",
    label: "Confirm deleting a group",
    description: "Show a warning before a group is deleted and its instances become standalone lines.",
    settingKey: "confirmGroupDissolution",
  },
  confirmSyncReset: {
    section: "confirmations",
    group: "Resets",
    label: "Confirm resetting sync timing",
    description: "Show a warning before clearing every word and line timing in the sync view.",
    settingKey: "confirmSyncReset",
  },
  confirmClearProject: {
    section: "confirmations",
    group: "Resets",
    label: "Confirm clearing project",
    description: "Show a warning before discarding the current project, metadata, and audio file.",
    settingKey: "confirmClearProject",
  },
  confirmResetSettings: {
    section: "confirmations",
    group: "Resets",
    label: "Confirm resetting all settings",
    description: "Show a warning before restoring all settings to their defaults.",
    settingKey: "confirmResetSettings",
  },
  confirmResetShortcuts: {
    section: "confirmations",
    group: "Resets",
    label: "Confirm resetting all shortcuts",
    description: "Show a warning before clearing all custom keyboard bindings.",
    settingKey: "confirmResetShortcuts",
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { CONFIRMATIONS_CATALOG_ENTRIES };
