import type { SettingEntry } from "@/stores/settings-catalog";
import { MOD_KEY } from "@/utils/platform";

// -- Catalog ------------------------------------------------------------------

const SNAP_CATALOG_ENTRIES = {
  timelineSnap: {
    section: "snap",
    label: "Snap (magnet)",
    description: "Word edges snap to nearby anchors when dragging or resizing.",
    settingKey: "timelineSnap",
  },
  snapWordsAndLines: {
    section: "snap",
    group: "Snap to",
    label: "Snap to words and lines",
    description: "Include word and line edges as snap targets.",
    settingKey: "snapWordsAndLines",
  },
  snapMarkers: {
    section: "snap",
    group: "Snap to",
    label: "Snap to markers",
    description: "Include your markers as snap targets.",
    keywords: ["snap point", "pin"],
    settingKey: "snapMarkers",
  },
  vocalOnsetSnap: {
    section: "snap",
    group: "Snap to",
    label: "Vocal onset snap",
    description: "Include detected vocal onset anchors as snap targets in the timeline.",
    settingKey: "vocalOnsetSnap",
  },
  beatSnap: {
    section: "snap",
    group: "Snap to",
    label: "Snap to beats",
    description: "Include visible beat grid lines as snap targets.",
    keywords: ["bpm", "tempo", "bar"],
    settingKey: "beatSnap",
  },
  snapToPlayhead: {
    section: "snap",
    group: "Snap to",
    label: "Snap to playhead",
    description: "Include the playhead as a snap target.",
    keywords: ["cursor"],
    settingKey: "snapToPlayhead",
  },
  snapPlayheadToPoints: {
    section: "snap",
    group: "Snap to",
    label: "Snap playhead to points",
    description: `Clicking or dragging the playhead snaps it to nearby snap points and vocal onsets. Hold ${MOD_KEY} to bypass.`,
    settingKey: "snapPlayheadToPoints",
  },
  snapDistanceWords: {
    section: "snap",
    group: "Snap distance",
    label: "Words and lines snap distance",
    description: "How close, in pixels, a moving edge must come to word and line edges to lock on.",
    keywords: ["threshold", "strength"],
    settingKey: "snapDistanceWords",
  },
  snapDistanceMarkers: {
    section: "snap",
    group: "Snap distance",
    label: "Markers snap distance",
    description: "How close, in pixels, a moving edge must come to your markers to lock on.",
    keywords: ["threshold", "strength"],
    settingKey: "snapDistanceMarkers",
  },
  snapDistanceOnsets: {
    section: "snap",
    group: "Snap distance",
    label: "Vocal onsets snap distance",
    description: "How close, in pixels, a moving edge must come to vocal onsets to lock on.",
    keywords: ["threshold", "strength"],
    settingKey: "snapDistanceOnsets",
  },
  snapDistanceBeats: {
    section: "snap",
    group: "Snap distance",
    label: "Beats snap distance",
    description: "How close, in pixels, a moving edge must come to beat grid lines to lock on.",
    keywords: ["threshold", "strength"],
    settingKey: "snapDistanceBeats",
  },
  snapDistancePlayhead: {
    section: "snap",
    group: "Snap distance",
    label: "Playhead snap distance",
    description: "How close, in pixels, a moving edge must come to the playhead to lock on.",
    keywords: ["threshold", "strength"],
    settingKey: "snapDistancePlayhead",
  },
  beatGridVisible: {
    section: "snap",
    group: "Beat grid",
    label: "Show beat grid",
    description: "Draw beats and bars behind the waveform when the project has a beat grid.",
    keywords: ["bpm", "tempo", "bar"],
    settingKey: "beatGridVisible",
  },
  beatGridLines: {
    section: "snap",
    group: "Beat grid",
    label: "Beat grid lines",
    description: "Finest grid lines to draw and snap to. Finer lines appear as you zoom in.",
    keywords: ["bpm", "tempo", "subdivision"],
    settingKey: "beatGridLines",
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { SNAP_CATALOG_ENTRIES };
