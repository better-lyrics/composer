import { isMac } from "@/utils/platform";

// -- Types --------------------------------------------------------------------

interface ShortcutBinding {
  key: string;
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  mod?: boolean;
}

type ShortcutScope = "global" | "sync" | "timeline" | "library";

interface ShortcutDefinition {
  id: string;
  scope: ShortcutScope;
  description: string;
  defaultBinding: ShortcutBinding;
  repeatable?: true;
  needsCommandKey?: true;
}

// -- Registry -----------------------------------------------------------------

const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: "global.playPause",
    scope: "global",
    description: "Play / Pause",
    defaultBinding: { key: "Enter" },
  },
  {
    id: "global.playPauseWhileTyping",
    scope: "global",
    description: "Play / Pause (works while typing)",
    defaultBinding: { key: "Enter", mod: true },
    needsCommandKey: true,
  },
  {
    id: "global.seekBackward",
    scope: "global",
    description: "Seek back",
    defaultBinding: { key: "<", shift: true },
    repeatable: true,
  },
  {
    id: "global.seekForward",
    scope: "global",
    description: "Seek forward",
    defaultBinding: { key: ">", shift: true },
    repeatable: true,
  },
  {
    id: "global.seekBackwardWhileTyping",
    scope: "global",
    description: "Seek back (works while typing)",
    defaultBinding: { key: "<", shift: true, mod: true },
    repeatable: true,
    needsCommandKey: true,
  },
  {
    id: "global.seekForwardWhileTyping",
    scope: "global",
    description: "Seek forward (works while typing)",
    defaultBinding: { key: ">", shift: true, mod: true },
    repeatable: true,
    needsCommandKey: true,
  },
  {
    id: "global.togglePlaybackSpeed",
    scope: "global",
    description: "Switch between normal speed and the last speed you used (0.75x at first)",
    defaultBinding: { key: "r", shift: true },
  },
  {
    id: "global.toggleStem",
    scope: "global",
    description: "Switch between the original audio and the last stem you used (vocals at first)",
    defaultBinding: { key: "o", shift: true },
  },
  {
    id: "global.help",
    scope: "global",
    description: "Show help",
    defaultBinding: { key: "?", shift: true },
  },
  {
    id: "global.settings",
    scope: "global",
    description: "Open settings",
    defaultBinding: { key: "," },
  },
  {
    id: "global.panicRecovery",
    scope: "global",
    description: "Download saved work (panic shortcut)",
    defaultBinding: { key: "e", mod: true, shift: true, alt: true },
  },
  {
    id: "global.goToImport",
    scope: "global",
    description: "Go to Import",
    defaultBinding: { key: "1", mod: true },
  },
  {
    id: "global.goToEdit",
    scope: "global",
    description: "Go to Edit",
    defaultBinding: { key: "2", mod: true },
  },
  {
    id: "global.goToLanguages",
    scope: "global",
    description: "Go to Languages",
    defaultBinding: { key: "3", mod: true },
  },
  {
    id: "global.goToSync",
    scope: "global",
    description: "Go to Sync",
    defaultBinding: { key: "4", mod: true },
  },
  {
    id: "global.goToTimeline",
    scope: "global",
    description: "Go to Timeline",
    defaultBinding: { key: "5", mod: true },
  },
  {
    id: "global.goToPreview",
    scope: "global",
    description: "Go to Preview",
    defaultBinding: { key: "6", mod: true },
  },
  {
    id: "global.goToExport",
    scope: "global",
    description: "Go to Export",
    defaultBinding: { key: "7", mod: true },
  },
  {
    id: "global.openProjectSwitcher",
    scope: "global",
    description: "Switch project",
    defaultBinding: { key: "o", mod: true },
  },
  {
    id: "global.newProject",
    scope: "global",
    description: "New project",
    defaultBinding: { key: "n", mod: true, alt: true },
  },
  {
    id: "global.saveNow",
    scope: "global",
    description: "Save now",
    defaultBinding: { key: "s", mod: true },
  },
  {
    id: "global.toggleLoop",
    scope: "global",
    description: "Loop the playback range",
    defaultBinding: { key: "l", shift: true },
  },
  {
    id: "global.undo",
    scope: "global",
    description: "Undo",
    defaultBinding: { key: "z", mod: true },
  },
  {
    id: "global.redo",
    scope: "global",
    description: "Redo",
    defaultBinding: { key: "z", mod: true, shift: true },
  },
  ...(isMac
    ? []
    : [
        {
          id: "global.redoAlternate",
          scope: "global" as const,
          description: "Redo (alternate)",
          defaultBinding: { key: "y", mod: true },
        },
      ]),
  {
    id: "library.focusSearch",
    scope: "library",
    description: "Search projects",
    defaultBinding: { key: "/" },
  },
  {
    id: "library.deleteSelection",
    scope: "library",
    description: "Delete selected projects",
    defaultBinding: { key: "Backspace" },
  },
  {
    id: "sync.tap",
    scope: "sync",
    description: "Tap to sync",
    defaultBinding: { key: " " },
  },
  {
    id: "sync.holdSync",
    scope: "sync",
    description: "Hold to sync",
    defaultBinding: { key: "f" },
  },
  {
    id: "sync.nudgeLeft",
    scope: "sync",
    description: "Nudge left",
    defaultBinding: { key: "ArrowLeft" },
  },
  {
    id: "sync.nudgeRight",
    scope: "sync",
    description: "Nudge right",
    defaultBinding: { key: "ArrowRight" },
  },
  {
    id: "sync.toggleTextVariant",
    scope: "sync",
    description: "Toggle original / transliteration text",
    defaultBinding: { key: "l" },
  },
  {
    id: "timeline.toggleFollow",
    scope: "timeline",
    description: "Toggle follow",
    defaultBinding: { key: "f" },
  },
  {
    id: "timeline.togglePreview",
    scope: "timeline",
    description: "Toggle preview",
    defaultBinding: { key: "p" },
  },
  {
    id: "timeline.insertLineBelow",
    scope: "timeline",
    description: "Insert line below",
    defaultBinding: { key: "n" },
  },
  {
    id: "timeline.insertLineAbove",
    scope: "timeline",
    description: "Insert line above",
    defaultBinding: { key: "n", shift: true },
  },
  {
    id: "timeline.jumpToPlayhead",
    scope: "timeline",
    description: "Jump to playhead",
    defaultBinding: { key: " " },
  },
  {
    id: "timeline.selectWordAtPlayhead",
    scope: "timeline",
    description: "Select word under playhead",
    defaultBinding: { key: "a" },
  },
  {
    id: "timeline.setWordBegin",
    scope: "timeline",
    description: "Set word begin",
    defaultBinding: { key: "[" },
  },
  {
    id: "timeline.setWordEnd",
    scope: "timeline",
    description: "Set word end",
    defaultBinding: { key: "]" },
  },
  {
    id: "timeline.editWord",
    scope: "timeline",
    description: "Edit word",
    defaultBinding: { key: "e" },
  },
  {
    id: "timeline.splitSyllable",
    scope: "timeline",
    description: "Split syllable",
    defaultBinding: { key: "s" },
  },
  {
    id: "timeline.splitWord",
    scope: "timeline",
    description: "Split word into words",
    defaultBinding: { key: "s", shift: true },
  },
  {
    id: "timeline.deleteSelection",
    scope: "timeline",
    description: "Delete selected words",
    defaultBinding: { key: "Backspace" },
  },
  {
    id: "timeline.deleteSelectionAlternate",
    scope: "timeline",
    description: "Delete selected words (alternate)",
    defaultBinding: { key: "Delete" },
  },
  {
    id: "timeline.mergeWords",
    scope: "timeline",
    description: "Merge words",
    defaultBinding: { key: "m" },
  },
  {
    id: "timeline.mergeSyllablesIntoWord",
    scope: "timeline",
    description: "Merge syllables back into one word",
    defaultBinding: { key: "y" },
  },
  {
    id: "timeline.splitIntoWords",
    scope: "timeline",
    description: "Split line into words",
    defaultBinding: { key: "w" },
  },
  {
    id: "timeline.expandAll",
    scope: "timeline",
    description: "Expand all lines",
    defaultBinding: { key: "x" },
  },
  {
    id: "timeline.importLyrics",
    scope: "timeline",
    description: "Import lyrics",
    defaultBinding: { key: "v", mod: true, shift: true },
  },
  {
    id: "timeline.createGroup",
    scope: "timeline",
    description: "Group selected lines",
    defaultBinding: { key: "g", mod: true },
  },
  {
    id: "timeline.duplicateAsLinked",
    scope: "timeline",
    description: "Duplicate as linked instance",
    defaultBinding: { key: "d", mod: true },
  },
  {
    id: "timeline.toggleCollapseInstance",
    scope: "timeline",
    description: "Collapse / expand current instance",
    defaultBinding: { key: "c" },
  },
  {
    id: "timeline.toggleAllCollapsed",
    scope: "timeline",
    description: "Collapse / expand all instances",
    defaultBinding: { key: "c", shift: true },
  },
  {
    id: "timeline.openGroup",
    scope: "timeline",
    description: "Open group",
    defaultBinding: { key: "Enter", shift: true },
  },
  {
    id: "timeline.closeGroup",
    scope: "timeline",
    description: "Close group",
    defaultBinding: { key: "Escape" },
  },
  {
    id: "timeline.playSelection",
    scope: "timeline",
    description: "Play the selection",
    defaultBinding: { key: "Enter", alt: true },
  },
  {
    id: "timeline.jumpPrevInstance",
    scope: "timeline",
    description: "Jump to previous instance of group",
    defaultBinding: { key: "j", mod: true },
    repeatable: true,
  },
  {
    id: "timeline.jumpNextInstance",
    scope: "timeline",
    description: "Jump to next instance of group",
    defaultBinding: { key: "k", mod: true },
    repeatable: true,
  },
  {
    id: "timeline.detachInstance",
    scope: "timeline",
    description: "Detach current instance from group",
    defaultBinding: { key: "d", mod: true, shift: true },
  },
  {
    id: "timeline.deleteGroup",
    scope: "timeline",
    description: "Delete current group",
    defaultBinding: { key: "g", mod: true, shift: true },
  },
  {
    id: "timeline.pingSiblings",
    scope: "timeline",
    description: "Ping sibling instances",
    defaultBinding: { key: "h" },
  },
  {
    id: "timeline.shiftInstanceToPlayhead",
    scope: "timeline",
    description: "Shift current instance to playhead",
    defaultBinding: { key: "p", shift: true },
  },
  {
    id: "timeline.jumpToInstanceStart",
    scope: "timeline",
    description: "Jump to start of current instance",
    defaultBinding: { key: "j", shift: true },
  },
  {
    id: "timeline.nudgeLeft",
    scope: "timeline",
    description: "Nudge selected words left",
    defaultBinding: { key: "ArrowLeft" },
    repeatable: true,
  },
  {
    id: "timeline.nudgeRight",
    scope: "timeline",
    description: "Nudge selected words right",
    defaultBinding: { key: "ArrowRight" },
    repeatable: true,
  },
  {
    id: "timeline.toggleExplicit",
    scope: "timeline",
    description: "Toggle explicit on selected word(s)",
    defaultBinding: { key: "e", shift: true },
  },
  {
    id: "timeline.toggleTextVariant",
    scope: "timeline",
    description: "Toggle original / transliteration text",
    defaultBinding: { key: "l" },
  },
  {
    id: "timeline.toggleSnap",
    scope: "timeline",
    description: "Toggle snap (magnet)",
    defaultBinding: { key: "t" },
  },
  {
    id: "timeline.toggleRollingEdit",
    scope: "timeline",
    description: "Toggle rolling edit tool",
    defaultBinding: { key: "r" },
  },
  {
    id: "timeline.toggleMarkerMode",
    scope: "timeline",
    description: "Toggle marker mode",
    defaultBinding: { key: "i" },
  },
  {
    id: "timeline.dropSnapMarkerAtPlayhead",
    scope: "timeline",
    description: "Drop snap marker at playhead",
    defaultBinding: { key: "i", shift: true },
  },
  {
    id: "timeline.jumpPrevSnapPoint",
    scope: "timeline",
    description: "Jump to previous snap point",
    defaultBinding: { key: "ArrowLeft", shift: true },
    repeatable: true,
  },
  {
    id: "timeline.jumpNextSnapPoint",
    scope: "timeline",
    description: "Jump to next snap point",
    defaultBinding: { key: "ArrowRight", shift: true },
    repeatable: true,
  },
  {
    id: "timeline.jumpPrevSnapPointFine",
    scope: "timeline",
    description: "Jump to previous snap point or onset",
    defaultBinding: { key: "ArrowLeft", shift: true, alt: true },
    repeatable: true,
  },
  {
    id: "timeline.jumpNextSnapPointFine",
    scope: "timeline",
    description: "Jump to next snap point or onset",
    defaultBinding: { key: "ArrowRight", shift: true, alt: true },
    repeatable: true,
  },
  {
    id: "timeline.copy",
    scope: "timeline",
    description: "Copy selected words",
    defaultBinding: { key: "c", mod: true },
  },
  {
    id: "timeline.cut",
    scope: "timeline",
    description: "Cut selected words",
    defaultBinding: { key: "x", mod: true },
  },
  {
    id: "timeline.paste",
    scope: "timeline",
    description: "Paste copied words",
    defaultBinding: { key: "v", mod: true },
  },
];

// -- Exports ------------------------------------------------------------------

export { SHORTCUT_DEFINITIONS };
export type { ShortcutBinding, ShortcutScope, ShortcutDefinition };
