import type { SettingEntry } from "@/stores/settings-catalog";

// -- Catalog ------------------------------------------------------------------

const UNISON_CATALOG_ENTRIES = {
  unisonEnabled: {
    section: "unison",
    label: "Unison features",
    description:
      "Share lyrics with Better Lyrics listeners and follow their reviews. Turning this off hides Unison everywhere and keeps your account and project links.",
    keywords: ["better lyrics", "share", "submit", "community", "disable", "hide"],
    settingKey: "unisonEnabled",
  },
  unisonAccount: {
    section: "unison",
    label: "Better Lyrics account",
    description: "The account Composer uses to send lyrics to Unison.",
    keywords: ["sign out", "disconnect", "log out", "connect", "sign in"],
    visibleWhen: (state) => state.unisonEnabled,
  },
  unisonLibraryColumn: {
    section: "unison",
    group: "Projects",
    label: "Unison column",
    description: "Show each project's Unison status and score, and the On Unison filter.",
    keywords: ["library", "status", "score", "filter"],
    settingKey: "unisonLibraryColumn",
    visibleWhen: (state) => state.unisonEnabled,
  },
  unisonLibraryNotices: {
    section: "unison",
    group: "Projects",
    label: "Review updates",
    description: "List approvals, declines and hidden lyrics since your last visit.",
    keywords: ["library", "notices", "approved", "declined", "since you were last here"],
    settingKey: "unisonLibraryNotices",
    visibleWhen: (state) => state.unisonEnabled,
  },
  unisonWantedShelf: {
    section: "unison",
    group: "Projects",
    label: "Most wanted songs",
    description: "Show the songs listeners are asking lyrics for.",
    keywords: ["library", "requests", "wanted", "shelf"],
    settingKey: "unisonWantedShelf",
    visibleWhen: (state) => state.unisonEnabled,
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { UNISON_CATALOG_ENTRIES };
