import type { KeepYouTubeAudio } from "@/domain/storage/audio-retention";
import type { SettingEntry } from "@/stores/settings-catalog";

// -- Descriptions -------------------------------------------------------------

function keepYouTubeAudioDescription(rule: KeepYouTubeAudio, bridgeEnabled: boolean): string {
  if (rule === "never") return "YouTube audio is fetched each time you open a project.";
  if (rule === "always") return "YouTube audio is kept, so projects open offline. Cleanup can still remove it.";
  return bridgeEnabled
    ? "Composer Bridge is on, so YouTube audio is fetched when you open a project and not kept."
    : "Composer Bridge is off, so YouTube audio is kept. Fetching it again can fail.";
}

// -- Catalog ------------------------------------------------------------------

const STORAGE_CATALOG_ENTRIES = {
  storageUsage: {
    section: "storage",
    label: "Storage usage",
    description: "How much space Composer is using on this device, broken down by category.",
    keywords: ["space", "disk", "quota", "local audio", "youtube audio", "stems", "lyrics", "free"],
    group: "Usage",
  },
  storageProtection: {
    section: "storage",
    label: "Storage protection",
    description: "Ask the browser not to clear Composer's data when disk space runs low.",
    keywords: ["persist", "persisted", "protect", "cleanup", "browser"],
    group: "Usage",
  },
  keepYouTubeAudio: {
    section: "storage",
    label: "Keep YouTube audio",
    keywords: ["youtube", "cache"],
    settingKey: "keepYouTubeAudio",
    group: "Audio",
    descriptionFor: (state) => keepYouTubeAudioDescription(state.keepYouTubeAudio, state.experiments.youtubeBridge),
  },
  smartCleanup: {
    section: "storage",
    label: "Smart cleanup",
    description:
      "When space runs low or you pass the limit, remove vocal stems first, then YouTube audio you haven't opened in a while. Local files and the open project are never removed.",
    keywords: ["cleanup", "space"],
    settingKey: "smartCleanup",
    group: "Audio",
  },
  storageLimit: {
    section: "storage",
    label: "Storage limit",
    description: "Cleanup starts above this size.",
    keywords: ["limit", "quota"],
    settingKey: "storageLimit",
    group: "Audio",
    visibleWhen: (state) => state.smartCleanup,
  },
  projectAudioList: {
    section: "storage",
    label: "Audio by project",
    description: "Removing audio keeps the lyrics and timings. You can add the file again later.",
    keywords: ["audio", "stems", "remove", "files", "space"],
    group: "Audio",
  },
  autoSaveDelay: {
    section: "storage",
    label: "Auto-save delay",
    description: "How long to wait after your last edit before auto-saving.",
    settingKey: "autoSaveDelay",
    group: "Saving",
  },
  backUpAllProjects: {
    section: "storage",
    label: "Back up all projects",
    description: "Download every project's lyrics and timings as one file. Audio is not included.",
    keywords: ["backup", "export all", "download"],
    group: "Saving",
  },
  deleteAllProjects: {
    section: "storage",
    label: "Delete all projects",
    description: "Remove every project and all stored audio from this device. This can't be undone.",
    keywords: ["delete all", "erase", "reset"],
    group: "Saving",
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { STORAGE_CATALOG_ENTRIES, keepYouTubeAudioDescription };
