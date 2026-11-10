import type { SettingEntry } from "@/stores/settings-catalog";

// -- Catalog ------------------------------------------------------------------

const TIMELINE_CATALOG_ENTRIES = {
  defaultZoom: {
    section: "timeline",
    group: "View",
    label: "Default zoom",
    description: "Initial zoom level (px/sec) when opening the timeline.",
    settingKey: "defaultZoom",
  },
  defaultRowHeight: {
    section: "timeline",
    group: "View",
    label: "Default row height",
    description: "Starting height of each lyric row in the timeline.",
    settingKey: "defaultRowHeight",
  },
  previewSidebar: {
    section: "timeline",
    group: "View",
    label: "Preview sidebar",
    description: "Show the lyrics preview beside the timeline.",
    settingKey: "previewSidebar",
  },
  timelineHorizontalScroll: {
    section: "timeline",
    group: "View",
    label: "Scroll wheel scrolls timeline",
    description: "Plain scroll moves the timeline horizontally. Hold Shift to scroll vertically.",
    keywords: ["mouse", "wheel", "horizontal"],
    settingKey: "timelineHorizontalScroll",
  },
  followPlayhead: {
    section: "timeline",
    group: "Playhead",
    label: "Follow playhead",
    description: "Auto-scroll the timeline to keep the playhead visible.",
    keywords: ["auto scroll"],
    settingKey: "followPlayhead",
  },
  returnToCue: {
    section: "timeline",
    group: "Playhead",
    label: "Return to cue",
    description: "Play starts from the cue, and stopping puts the playhead back on it.",
    keywords: ["cue", "replay", "return", "stop", "onset", "latch"],
    settingKey: "returnToCue",
  },
  selectionLeadIn: {
    section: "timeline",
    group: "Playhead",
    label: "Selection lead-in",
    description:
      "Extra audio before and after a played selection, so you hear the words around it. 0 plays it exactly.",
    keywords: ["preroll", "pre-roll", "padding", "play selection", "loop"],
    settingKey: "selectionLeadIn",
  },
  shareTimingInNewGroups: {
    section: "timeline",
    group: "Groups",
    label: "Share timing in new groups",
    description: "Sync one instance of a new group and the others follow, each from its own start.",
    keywords: ["group", "instance", "chorus", "linked", "repeat"],
    settingKey: "shareTimingInNewGroups",
  },
  loopOpenGroup: {
    section: "timeline",
    group: "Groups",
    label: "Loop an open group",
    description: "Play an open group on repeat instead of stopping at its end.",
    keywords: ["group", "instance", "chorus", "repeat", "solo"],
    settingKey: "loopOpenGroup",
  },
  rollingEdit: {
    section: "timeline",
    group: "Editing",
    label: "Rolling edit",
    description: "Dragging a shared word boundary moves both words together.",
    settingKey: "rollingEdit",
  },
  syllablesFollowRolling: {
    section: "timeline",
    group: "Editing",
    label: "Syllables follow rolling edit",
    description:
      "Syllables of one word move together only in rolling edit mode, like separate words. When off, they always move together.",
    settingKey: "syllablesFollowRolling",
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { TIMELINE_CATALOG_ENTRIES };
