import type { SettingEntry } from "@/stores/settings-catalog";

// -- Catalog ------------------------------------------------------------------

const PLAYBACK_CATALOG_ENTRIES = {
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
  seekStep: {
    section: "playback",
    group: "Seeking",
    label: "Seek step",
    description: "How far the seek back and seek forward shortcuts move the playhead.",
    keywords: ["skip", "rewind", "forward", "jump"],
    settingKey: "seekStep",
  },
  fineSeekStep: {
    section: "playback",
    group: "Seeking",
    label: "Fine seek step",
    description: "How far the fine seek shortcuts move the playhead. Keep it small to land right before a word.",
    keywords: ["skip", "rewind", "forward", "jump", "frame", "nudge"],
    settingKey: "fineSeekStep",
  },
  audioScrubPreview: {
    section: "playback",
    group: "Seeking",
    label: "Audio scrub preview",
    description: "Play a short audio snippet while dragging or wheel-scrubbing the playhead.",
    keywords: ["scrub", "sound"],
    settingKey: "audioScrubPreview",
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { PLAYBACK_CATALOG_ENTRIES };
