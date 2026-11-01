import type { SettingsState } from "@/stores/settings";
import type { SettingEntry } from "@/stores/settings-catalog";
import { CONFIRMATIONS_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-confirmations";
import { GENERAL_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-general";
import { LYRICS_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-lyrics";
import { MODELS_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-models";
import { PLAYBACK_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-playback";
import { SNAP_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-snap";
import { SPECTRUM_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-spectrum";
import { STORAGE_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-storage";
import { SYNC_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-sync";
import { TIMELINE_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-timeline";

// -- Catalog ------------------------------------------------------------------

const SETTINGS_CATALOG = {
  ...GENERAL_CATALOG_ENTRIES,
  theme: {
    section: "theme",
    label: "Theme",
    description: "Pick a preset, customize colors, or import a theme code.",
    keywords: ["color", "colour", "palette", "dark", "light", "appearance", "preset", "import", "code"],
  },
  shortcutPreset: {
    section: "shortcuts",
    label: "Shortcut presets",
    description: "Pick a whole layout, or import a shortcuts code.",
    keywords: ["preset", "layout", "space", "enter", "amll", "osu", "remastered", "import", "code", "share"],
  },
  ...CONFIRMATIONS_CATALOG_ENTRIES,
  ...LYRICS_CATALOG_ENTRIES,
  ...PLAYBACK_CATALOG_ENTRIES,
  ...SYNC_CATALOG_ENTRIES,
  ...TIMELINE_CATALOG_ENTRIES,
  ...SNAP_CATALOG_ENTRIES,
  ...SPECTRUM_CATALOG_ENTRIES,
  ...STORAGE_CATALOG_ENTRIES,
  ...MODELS_CATALOG_ENTRIES,
  previewRenderer: {
    section: "advanced",
    label: "Preview renderer",
    description: "Which engine renders synced lyrics in the Preview tab and the Timeline preview.",
    settingKey: "previewRenderer",
  },
  youtubeBridge: {
    section: "advanced",
    label: "Composer Bridge for YouTube",
    description: "Route YouTube imports through a small local binary running on your machine instead of Cobalt.",
    keywords: ["bridge", "yt-dlp", "local"],
    readOn: (state: SettingsState) => state.experiments.youtubeBridge,
  },
  cobaltInstances: {
    section: "advanced",
    label: "Cobalt instances",
    description:
      "Composer uses a Cobalt backend to fetch YouTube audio. The default one is currently blocked by YouTube, so add a working instance from cobalt.directory below, or self-host.",
    keywords: ["youtube", "download", "server"],
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { SETTINGS_CATALOG };
