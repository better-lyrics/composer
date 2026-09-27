import type { SettingsState } from "@/stores/settings";
import type { SettingEntry } from "@/stores/settings-catalog";
import { MOD_KEY } from "@/utils/platform";

// -- Catalog -------------------------------------------------------------------

const SETTINGS_CATALOG = {
  showShortcutHints: {
    section: "general",
    label: "Show shortcut hints",
    description: "Display keyboard shortcut badges on toolbar buttons.",
    keywords: ["badges", "keys", "hotkeys"],
    settingKey: "showShortcutHints",
  },
  showSyllableIndicators: {
    section: "general",
    label: "Show syllable indicators",
    description: "Visually group syllables split from one word.",
    keywords: ["split", "pipe"],
    settingKey: "showSyllableIndicators",
  },
  autoExtractBackgroundVocals: {
    section: "general",
    label: "Auto-extract background vocals",
    description: "Move parenthesised text into background vocals when lyrics are pasted, imported, or edited.",
    keywords: ["bg", "parentheses", "brackets"],
    settingKey: "autoExtractBackgroundVocals",
  },
  mergeStandaloneBackgroundLines: {
    section: "general",
    label: "Merge standalone background lines",
    description:
      "When a whole line is in parentheses, attach it to the line above instead of keeping it as its own line.",
    keywords: ["bg", "parentheses"],
    settingKey: "mergeStandaloneBackgroundLines",
  },
  preserveBracketsOnExtraction: {
    section: "general",
    label: "Preserve brackets when extracting",
    description: "Keep parentheses around extracted background vocals. Multiple snippets share one outer pair.",
    keywords: ["bg", "parentheses"],
    settingKey: "preserveBracketsOnExtraction",
  },
  theme: {
    section: "theme",
    label: "Theme",
    description: "Pick a preset, customize colors, or import a theme code.",
    keywords: ["color", "colour", "palette", "dark", "light", "appearance", "preset", "import", "code"],
  },
  defaultPlaybackRate: {
    section: "playback",
    label: "Default playback rate",
    description: "Starting playback speed when audio is loaded.",
    keywords: ["speed", "tempo"],
    settingKey: "defaultPlaybackRate",
  },
  preservePitch: {
    section: "playback",
    label: "Preserve pitch",
    description: "Keep pitch steady when the playback speed changes.",
    keywords: ["speed"],
    settingKey: "preservePitch",
  },
  rememberVolume: {
    section: "playback",
    label: "Remember volume",
    description: "Keep your volume level between sessions.",
    settingKey: "rememberVolume",
  },
  audioScrubPreview: {
    section: "playback",
    label: "Audio scrub preview",
    description: "Play a short audio snippet while dragging or wheel-scrubbing the playhead.",
    keywords: ["scrub", "sound"],
    settingKey: "audioScrubPreview",
  },
  autoSeparateOnImport: {
    section: "playback",
    label: "Auto-separate vocals on import",
    description: "Run the vocal-separation model automatically each time a new audio file is loaded.",
    keywords: ["stems", "isolate"],
    settingKey: "autoSeparateOnImport",
  },
  vocalModelVariant: {
    section: "playback",
    label: "Vocal model precision",
    description: "fp32 is the stable default. fp16 is smaller but may produce invalid output in some browsers.",
    keywords: ["fp16", "fp32", "stems", "separation"],
    settingKey: "vocalModelVariant",
  },
  defaultZoom: {
    section: "timeline",
    label: "Default zoom",
    description: "Initial zoom level (px/sec) when opening the timeline.",
    settingKey: "defaultZoom",
  },
  defaultRowHeight: {
    section: "timeline",
    label: "Default row height",
    description: "Starting height of each lyric row in the timeline.",
    settingKey: "defaultRowHeight",
  },
  timelineSnap: {
    section: "timeline",
    label: "Snap (magnet)",
    description: "Word edges snap to nearby anchors when dragging or resizing.",
    settingKey: "timelineSnap",
  },
  vocalOnsetSnap: {
    section: "timeline",
    label: "Vocal onset snap",
    description: "Include detected vocal onset anchors as snap targets in the timeline.",
    settingKey: "vocalOnsetSnap",
  },
  timelineSnapThreshold: {
    section: "timeline",
    label: "Snap threshold",
    description: "Distance (in pixels) at which the moving block locks onto an anchor.",
    keywords: ["distance"],
    settingKey: "timelineSnapThreshold",
  },
  snapPlayheadToPoints: {
    section: "timeline",
    label: "Snap playhead to points",
    description: `Clicking or dragging the playhead snaps it to nearby snap points and vocal onsets. Hold ${MOD_KEY} to bypass.`,
    settingKey: "snapPlayheadToPoints",
  },
  followPlayhead: {
    section: "timeline",
    label: "Follow playhead",
    description: "Auto-scroll the timeline to keep the playhead visible.",
    keywords: ["auto scroll"],
    settingKey: "followPlayhead",
  },
  defaultRollingEdit: {
    section: "timeline",
    label: "Default rolling edit mode",
    description: "Start in rolling edit mode when opening a project.",
    settingKey: "defaultRollingEdit",
  },
  syllablesFollowRolling: {
    section: "timeline",
    label: "Syllables follow rolling edit",
    description:
      "Syllables of one word move together only in rolling edit mode, like separate words. When off, they always move together.",
    settingKey: "syllablesFollowRolling",
  },
  defaultPreviewSidebar: {
    section: "timeline",
    label: "Default preview sidebar",
    description: "Open the preview sidebar by default.",
    settingKey: "defaultPreviewSidebar",
  },
  timelineHorizontalScroll: {
    section: "timeline",
    label: "Scroll wheel scrolls timeline",
    description: "Plain scroll moves the timeline horizontally. Hold Shift to scroll vertically.",
    keywords: ["mouse", "wheel", "horizontal"],
    settingKey: "timelineHorizontalScroll",
  },
  splitCharacter: {
    section: "sync",
    label: "Split character",
    description: "Character used to mark syllable boundaries in the edit view.",
    keywords: ["syllable", "pipe", "separator"],
    settingKey: "splitCharacter",
  },
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
    description: "How far before the selected line or word playback starts when re-recording in Sync.",
    settingKey: "redoPreroll",
  },
  defaultGranularity: {
    section: "sync",
    label: "Default granularity",
    description: "Whether new projects start in word or line timing mode.",
    settingKey: "defaultGranularity",
  },
  confirmReplaceProjectFromHash: {
    section: "confirmations",
    label: "Confirm replacing project from URL",
    description: "Show a warning when an import URL would replace your current project.",
    settingKey: "confirmReplaceProjectFromHash",
  },
  confirmReplaceLyrics: {
    section: "confirmations",
    label: "Confirm replacing lyrics on import",
    description: "Show a warning when importing lyrics into a project that already has lines.",
    settingKey: "confirmReplaceLyrics",
  },
  confirmSyncReset: {
    section: "confirmations",
    label: "Confirm resetting sync timing",
    description: "Show a warning before clearing every word and line timing in the sync view.",
    settingKey: "confirmSyncReset",
  },
  confirmClearProject: {
    section: "confirmations",
    label: "Confirm clearing project",
    description: "Show a warning before discarding the current project, metadata, and audio file.",
    settingKey: "confirmClearProject",
  },
  confirmResetSettings: {
    section: "confirmations",
    label: "Confirm resetting all settings",
    description: "Show a warning before restoring all settings to their defaults.",
    settingKey: "confirmResetSettings",
  },
  confirmResetShortcuts: {
    section: "confirmations",
    label: "Confirm resetting all shortcuts",
    description: "Show a warning before clearing all custom keyboard bindings.",
    settingKey: "confirmResetShortcuts",
  },
  confirmApplyToAllSyllableSplit: {
    section: "confirmations",
    label: "Confirm before splitting multiple identical words",
    description: "Show a warning when a syllable split would also apply to other identical words across the project.",
    settingKey: "confirmApplyToAllSyllableSplit",
  },
  confirmConformToGroup: {
    section: "confirmations",
    label: "Confirm conforming lines to a group",
    description: "Show a warning before existing lines take on a group's text and timing.",
    settingKey: "confirmConformToGroup",
  },
  confirmGroupDissolution: {
    section: "confirmations",
    label: "Confirm deleting a group",
    description: "Show a warning before a group is deleted and its instances become standalone lines.",
    settingKey: "confirmGroupDissolution",
  },
  confirmClearImportedSongDetails: {
    section: "confirmations",
    label: "Confirm clearing imported song details",
    description: "Show a warning before a new song clears imported details you have not exported.",
    settingKey: "confirmClearImportedSongDetails",
  },
  autoSaveDelay: {
    section: "storage",
    label: "Auto-save delay",
    description: "How long to wait after your last edit before auto-saving.",
    settingKey: "autoSaveDelay",
  },
  previewRenderer: {
    section: "advanced",
    label: "Preview renderer",
    description: "Which engine renders synced lyrics in the Preview tab.",
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

// -- Exports -------------------------------------------------------------------

export { SETTINGS_CATALOG };
