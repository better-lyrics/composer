import { toast } from "sonner";
import { askChoice } from "@/stores/choice-store";
import { bindingToKeys, getShortcutDescription, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { clashingOverrides, overridesAfterSwitch } from "@/stores/shortcut-preset-switch";
import { presetBinding, type ShortcutPresetId, shortcutPreset } from "@/stores/shortcut-presets";
import { getShortcutById, type ShortcutBinding } from "@/stores/shortcut-registry";
import { pluralize } from "@/utils/pluralize";

// -- Helpers -------------------------------------------------------------------

function keysText(binding: ShortcutBinding): string {
  return bindingToKeys(binding).join("+");
}

function clashSentence(target: ShortcutPresetId, id: string, override: ShortcutBinding): string {
  const action = getShortcutDescription(id);
  const presetKey = presetBinding(target, id) ?? getShortcutById(id)?.defaultBinding ?? { key: "" };
  return `Your ${keysText(override)} key for ${action} clashes with ${shortcutPreset(target).name}, so ${action} goes back to ${keysText(presetKey)}.`;
}

function switchPromptBody(target: ShortcutPresetId, overrides: Record<string, ShortcutBinding>): string {
  const { name } = shortcutPreset(target);
  const clashes = clashingOverrides(target, overrides).map((id) => clashSentence(target, id, overrides[id]));
  const intro = `You changed ${pluralize(Object.keys(overrides).length, "key")}. Keep them on top of ${name}, or use ${name} as it comes?`;
  return [intro, ...clashes].join(" ");
}

// Undo writes back the preset and keys that were in place before this write.
function applyShortcutsWithUndo(
  preset: ShortcutPresetId,
  overrides: Record<string, ShortcutBinding>,
  title: string,
  description?: string,
): void {
  const previous = useShortcutBindingsStore.getState();
  const restore = { preset: previous.preset, overrides: previous.overrides };
  previous.setPreset(preset, overrides);
  toast(title, {
    description,
    action: {
      label: "Undo",
      onClick: () => useShortcutBindingsStore.getState().setPreset(restore.preset, restore.overrides),
    },
  });
}

async function switchShortcutPreset(target: ShortcutPresetId): Promise<void> {
  const { preset, overrides } = useShortcutBindingsStore.getState();
  if (target === preset) return;
  const { name } = shortcutPreset(target);
  if (Object.keys(overrides).length === 0) {
    applyShortcutsWithUndo(target, {}, `Using ${name}`);
    return;
  }
  const answer = await askChoice({
    title: `Switch to ${name}?`,
    body: switchPromptBody(target, overrides),
    busyMessage: "Answer the open prompt first",
    options: [
      { value: "clean", label: `Use ${name} as is`, variant: "secondary" },
      { value: "keep", label: "Keep my changes", variant: "primary" },
    ],
  });
  if (answer === "cancel") return;
  useShortcutBindingsStore.getState().setPreset(target, overridesAfterSwitch(target, overrides, answer === "keep"));
}

// -- Exports -------------------------------------------------------------------

export { applyShortcutsWithUndo, switchShortcutPreset };
