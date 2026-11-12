import type { SettingEntry } from "@/stores/settings-catalog";

// -- Catalog ------------------------------------------------------------------

const CONFIRMATIONS_CATALOG_ENTRIES = {
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
  confirmResetSettings: {
    section: "confirmations",
    group: "Resets",
    label: "Confirm resetting all settings",
    description: "Show a warning before restoring all settings to their defaults.",
    settingKey: "confirmResetSettings",
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { CONFIRMATIONS_CATALOG_ENTRIES };
