import type { SettingEntry } from "@/stores/settings-catalog";
import { pluralize } from "@/utils/pluralize";

// -- Helpers ------------------------------------------------------------------

function syncCountInDescription(seconds: number): string {
  if (seconds === 0) return "Playback starts right away in Sync.";
  return `Count down for ${pluralize(seconds, "second")} before Sync plays from the start of the song, so you are ready for the first word.`;
}

// -- Catalog ------------------------------------------------------------------

const SYNC_CATALOG_ENTRIES = {
  nudgeAmount: {
    section: "sync",
    label: "Nudge amount",
    description: "How far timing shifts when using nudge controls.",
    settingKey: "nudgeAmount",
  },
  defaultWordDuration: {
    section: "sync",
    label: "Default word duration",
    description: "Length assigned to newly created words in the timeline.",
    settingKey: "defaultWordDuration",
  },
  minWordDuration: {
    section: "sync",
    label: "Min word duration",
    description: "Shortest allowed duration for a word.",
    settingKey: "minWordDuration",
  },
  redoPreroll: {
    section: "sync",
    label: "Re-record pre-roll",
    description:
      "How far before the target line or word Sync starts playback after a jump, such as when you re-record a line or word, or when Sync skips past a repeat that already shares its timing.",
    settingKey: "redoPreroll",
  },
  syncCountIn: {
    section: "sync",
    label: "Count-in",
    descriptionFor: (state) => syncCountInDescription(state.syncCountIn),
    keywords: ["countdown", "pre-roll", "start delay"],
    settingKey: "syncCountIn",
  },
  defaultGranularity: {
    section: "sync",
    label: "Default granularity",
    description: "Whether new projects start in word or line timing mode.",
    settingKey: "defaultGranularity",
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { SYNC_CATALOG_ENTRIES };
