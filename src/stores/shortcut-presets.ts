import type { ShortcutBinding } from "@/stores/shortcut-registry";

// -- Types --------------------------------------------------------------------

type ShortcutPresetId = "composer" | "editor" | "remastered" | "amll" | "osu";

interface ShortcutPreset {
  id: ShortcutPresetId;
  name: string;
  description: string;
  bindings: Readonly<Record<string, ShortcutBinding>>;
}

// -- Constants ----------------------------------------------------------------

const DEFAULT_SHORTCUT_PRESET: ShortcutPresetId = "composer";

const SPACE_PLAYS: Record<string, ShortcutBinding> = {
  "global.playPause": { key: " " },
  "sync.tap": { key: "Enter" },
  "timeline.jumpToPlayhead": { key: "Enter" },
};

const ARROWS_SEEK: Record<string, ShortcutBinding> = {
  "global.seekBackward": { key: "ArrowLeft" },
  "global.seekForward": { key: "ArrowRight" },
  "global.seekBackwardFine": { key: "ArrowLeft", alt: true },
  "global.seekForwardFine": { key: "ArrowRight", alt: true },
  "sync.nudgeLeft": { key: "-" },
  "sync.nudgeRight": { key: "=" },
  "timeline.nudgeLeft": { key: "-" },
  "timeline.nudgeRight": { key: "=" },
};

const SHORTCUT_PRESETS: readonly ShortcutPreset[] = [
  { id: "composer", name: "Composer", description: "Composer's own keys.", bindings: {} },
  { id: "editor", name: "Editor", description: "Space plays, Enter taps.", bindings: SPACE_PLAYS },
  {
    id: "remastered",
    name: "Remastered",
    description: "Keys I should've shipped.",
    bindings: { ...SPACE_PLAYS, ...ARROWS_SEEK },
  },
  {
    id: "amll",
    name: "AMLL Tool",
    description: "Keys from AMLL Tool.",
    bindings: {
      ...SPACE_PLAYS,
      ...ARROWS_SEEK,
      "sync.tap": { key: "g" },
      "timeline.setWordBegin": { key: "f" },
      "timeline.setWordEnd": { key: "h" },
      "timeline.toggleFollow": { key: "f", shift: true },
      "timeline.pingSiblings": { key: "h", shift: true },
    },
  },
  {
    id: "osu",
    name: "osu!",
    description: "Tap Z, hold X, like the game.",
    bindings: {
      ...SPACE_PLAYS,
      "sync.tap": { key: "z" },
      "sync.holdSync": { key: "x" },
      "global.seekBackward": { key: "ArrowLeft", shift: true },
      "global.seekForward": { key: "ArrowRight", shift: true },
      "global.seekBackwardFine": { key: "ArrowLeft" },
      "global.seekForwardFine": { key: "ArrowRight" },
      "timeline.jumpPrevSnapPoint": { key: "ArrowUp" },
      "timeline.jumpNextSnapPoint": { key: "ArrowDown" },
      "sync.nudgeLeft": { key: "j" },
      "sync.nudgeRight": { key: "k" },
      "timeline.nudgeLeft": { key: "j" },
      "timeline.nudgeRight": { key: "k" },
      "timeline.togglePitchLine": { key: "k", shift: true },
    },
  },
];

// -- Helpers ------------------------------------------------------------------

const presetMap = new Map(SHORTCUT_PRESETS.map((preset) => [preset.id, preset]));

function shortcutPreset(id: ShortcutPresetId): ShortcutPreset {
  const preset = presetMap.get(id);
  if (!preset) throw new Error(`Unknown shortcut preset: ${id}`);
  return preset;
}

function presetBinding(presetId: ShortcutPresetId, shortcutId: string): ShortcutBinding | undefined {
  return shortcutPreset(presetId).bindings[shortcutId];
}

function isShortcutPresetId(value: unknown): value is ShortcutPresetId {
  return typeof value === "string" && presetMap.has(value as ShortcutPresetId);
}

// -- Exports ------------------------------------------------------------------

export type { ShortcutPreset, ShortcutPresetId };
export { DEFAULT_SHORTCUT_PRESET, isShortcutPresetId, presetBinding, SHORTCUT_PRESETS, shortcutPreset };
