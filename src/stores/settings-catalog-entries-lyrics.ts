import type { SettingEntry } from "@/stores/settings-catalog";

// -- Catalog ------------------------------------------------------------------

const LYRICS_CATALOG_ENTRIES = {
  splitCharacter: {
    section: "lyrics",
    label: "Split character",
    description: "Character used to mark syllable boundaries in the edit view.",
    keywords: ["syllable", "pipe", "separator"],
    settingKey: "splitCharacter",
  },
  showSyllableIndicators: {
    section: "lyrics",
    label: "Show syllable indicators",
    description: "Visually group syllables split from one word.",
    keywords: ["split", "pipe"],
    settingKey: "showSyllableIndicators",
  },
  autoExtractBackgroundVocals: {
    section: "lyrics",
    group: "Background vocals",
    label: "Auto-extract background vocals",
    description: "Move parenthesised text into background vocals when lyrics are pasted, imported, or edited.",
    keywords: ["bg", "parentheses", "brackets"],
    settingKey: "autoExtractBackgroundVocals",
  },
  mergeStandaloneBackgroundLines: {
    section: "lyrics",
    group: "Background vocals",
    label: "Merge standalone background lines",
    description:
      "When a whole line is in parentheses, attach it to the line above instead of keeping it as its own line.",
    keywords: ["bg", "parentheses"],
    settingKey: "mergeStandaloneBackgroundLines",
  },
  preserveBracketsOnExtraction: {
    section: "lyrics",
    group: "Background vocals",
    label: "Preserve brackets when extracting",
    description: "Keep parentheses around extracted background vocals. Multiple snippets share one outer pair.",
    keywords: ["bg", "parentheses"],
    settingKey: "preserveBracketsOnExtraction",
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { LYRICS_CATALOG_ENTRIES };
