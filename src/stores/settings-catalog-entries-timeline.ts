import type { SettingEntry } from "@/stores/settings-catalog";
import { MOD_KEY } from "@/utils/platform";

// -- Catalog ------------------------------------------------------------------

const TIMELINE_CATALOG_ENTRIES = {
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
  shareTimingInNewGroups: {
    section: "timeline",
    label: "Share timing in new groups",
    description: "Sync one instance of a new group and the others follow, each from its own start.",
    keywords: ["group", "instance", "chorus", "linked", "repeat"],
    settingKey: "shareTimingInNewGroups",
  },
  loopRange: {
    section: "timeline",
    label: "Loop playback range",
    description: "Play an open group or a played selection on repeat instead of stopping at its end.",
    keywords: ["group", "instance", "chorus", "repeat", "solo", "selection", "word", "line"],
    settingKey: "loopRange",
  },
  selectionLeadIn: {
    section: "timeline",
    label: "Selection lead-in",
    description:
      "Extra audio before and after a played selection, so you hear the words around it. 0 plays it exactly.",
    keywords: ["preroll", "pre-roll", "padding", "play selection", "loop"],
    settingKey: "selectionLeadIn",
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
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { TIMELINE_CATALOG_ENTRIES };
