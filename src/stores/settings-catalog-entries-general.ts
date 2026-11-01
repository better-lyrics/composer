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
  showSyllableIndicators: {
    section: "general",
    group: "Lyrics",
    label: "Show syllable indicators",
    description: "Visually group syllables split from one word.",
    keywords: ["split", "pipe"],
    settingKey: "showSyllableIndicators",
  },
  splitCharacter: {
    section: "general",
    group: "Lyrics",
    label: "Split character",
    description: "Character used to mark syllable boundaries in the edit view.",
    keywords: ["syllable", "pipe", "separator"],
    settingKey: "splitCharacter",
  },
  autoExtractBackgroundVocals: {
    section: "general",
    group: "Lyrics",
    label: "Auto-extract background vocals",
    description: "Move parenthesised text into background vocals when lyrics are pasted, imported, or edited.",
    keywords: ["bg", "parentheses", "brackets"],
    settingKey: "autoExtractBackgroundVocals",
  },
  mergeStandaloneBackgroundLines: {
    section: "general",
    group: "Lyrics",
    label: "Merge standalone background lines",
    description:
      "When a whole line is in parentheses, attach it to the line above instead of keeping it as its own line.",
    keywords: ["bg", "parentheses"],
    settingKey: "mergeStandaloneBackgroundLines",
  },
  preserveBracketsOnExtraction: {
    section: "general",
    group: "Lyrics",
    label: "Preserve brackets when extracting",
    description: "Keep parentheses around extracted background vocals. Multiple snippets share one outer pair.",
    keywords: ["bg", "parentheses"],
    settingKey: "preserveBracketsOnExtraction",
  },
  resetTour: {
    section: "general",
    label: "Reset product tour",
    description: "Restart the guided walkthrough that introduces Composer's features.",
    keywords: ["tour", "walkthrough", "onboarding", "guide"],
  },
  resetAllSettings: {
    section: "general",
    label: "Reset to defaults",
    description: "Restore all settings to their original values.",
    keywords: ["reset", "defaults", "restore"],
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { GENERAL_CATALOG_ENTRIES };
