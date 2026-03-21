// -- Types --------------------------------------------------------------------

interface ShortcutBinding {
  key: string;
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  mod?: boolean;
}

type ShortcutScope = "global" | "sync" | "timeline";

interface ShortcutDefinition {
  id: string;
  scope: ShortcutScope;
  description: string;
  defaultBinding: ShortcutBinding;
}

// -- Registry -----------------------------------------------------------------

const SHORTCUT_REGISTRY: ShortcutDefinition[] = [
  {
    id: "global.playPause",
    scope: "global",
    description: "Play / Pause",
    defaultBinding: { key: "Enter" },
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
    id: "global.goToSync",
    scope: "global",
    description: "Go to Sync",
    defaultBinding: { key: "3", mod: true },
  },
  {
    id: "global.goToTimeline",
    scope: "global",
    description: "Go to Timeline",
    defaultBinding: { key: "4", mod: true },
  },
  {
    id: "global.goToPreview",
    scope: "global",
    description: "Go to Preview",
    defaultBinding: { key: "5", mod: true },
  },
  {
    id: "global.goToExport",
    scope: "global",
    description: "Go to Export",
    defaultBinding: { key: "6", mod: true },
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
    id: "timeline.mergeWords",
    scope: "timeline",
    description: "Merge words",
    defaultBinding: { key: "m" },
  },
];

// -- Helpers ------------------------------------------------------------------

const registryMap = new Map<string, ShortcutDefinition>(SHORTCUT_REGISTRY.map((d) => [d.id, d]));

function getShortcutById(id: string): ShortcutDefinition | undefined {
  return registryMap.get(id);
}

function getShortcutsByScope(scope: ShortcutScope): ShortcutDefinition[] {
  return SHORTCUT_REGISTRY.filter((d) => d.scope === scope);
}

// -- Exports ------------------------------------------------------------------

export { SHORTCUT_REGISTRY, getShortcutById, getShortcutsByScope };
export type { ShortcutBinding, ShortcutScope, ShortcutDefinition };
