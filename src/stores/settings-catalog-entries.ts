import type { SettingsState } from "@/stores/settings";
import type { SettingEntry } from "@/stores/settings-catalog";
import { GENERAL_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-general";
import { SPECTRUM_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-spectrum";
import { STORAGE_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-storage";
import { TIMELINE_CATALOG_ENTRIES } from "@/stores/settings-catalog-entries-timeline";
import { pluralize } from "@/utils/pluralize";

// -- Helpers ------------------------------------------------------------------

function syncCountInDescription(seconds: number): string {
  if (seconds === 0) return "Playback starts right away in Sync.";
  return `Count down for ${pluralize(seconds, "second")} before Sync plays from the start of the song, so you are ready for the first word.`;
}

// -- Catalog ------------------------------------------------------------------

const SETTINGS_CATALOG = {
  ...GENERAL_CATALOG_ENTRIES,
  libraryView: {
    section: "projects",
    label: "Library view",
    description: "How the Projects page shows your songs. The toggle on that page changes this too.",
    settingKey: "libraryView",
  },
  librarySort: {
    section: "projects",
    label: "Default sort",
    description: "The order projects appear in when you open Projects.",
    settingKey: "librarySort",
  },
  launchScreen: {
    section: "projects",
    label: "On launch",
    description: "What Composer shows when you open it.",
    settingKey: "launchScreen",
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
    description: "Starting playback speed while Remember playback speed is off.",
    keywords: ["speed", "tempo"],
    settingKey: "defaultPlaybackRate",
  },
  rememberPlaybackRate: {
    section: "playback",
    label: "Remember playback speed",
    description: "Keep your playback speed between sessions.",
    keywords: ["speed", "tempo"],
    settingKey: "rememberPlaybackRate",
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
  seekStep: {
    section: "playback",
    label: "Seek step",
    description: "How far the seek back and seek forward shortcuts move the playhead.",
    keywords: ["skip", "rewind", "forward", "jump"],
    settingKey: "seekStep",
  },
  fineSeekStep: {
    section: "playback",
    label: "Fine seek step",
    description: "How far the fine seek shortcuts move the playhead. Keep it small to land right before a word.",
    keywords: ["skip", "rewind", "forward", "jump", "frame", "nudge"],
    settingKey: "fineSeekStep",
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
    description:
      "fp32 is the stable default. fp16 is smaller but needs WebGPU shader-f16 support, which not every browser or GPU provides.",
    keywords: ["fp16", "fp32", "stems", "separation"],
    settingKey: "vocalModelVariant",
  },
  alignmentModelId: {
    section: "playback",
    label: "Alignment model",
    description: "Checkpoint auto-align uses. Extra checkpoints come from the alignment model manifest.",
    keywords: ["hubertfa", "auto-align", "forced alignment", "checkpoint", "manifest"],
    settingKey: "alignmentModelId",
  },
  keepAlignmentModelLoaded: {
    section: "playback",
    label: "Keep alignment model loaded",
    description: "Keeps the model in memory between runs, so aligning one line at a time starts at once. Uses about 400 MB.",
    keywords: ["hubertfa", "auto-align", "memory", "gpu", "unload"],
    settingKey: "keepAlignmentModelLoaded",
  },
  ...TIMELINE_CATALOG_ENTRIES,
  ...SPECTRUM_CATALOG_ENTRIES,
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
  ...STORAGE_CATALOG_ENTRIES,
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
