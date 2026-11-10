import { bindingToKeys } from "@/stores/shortcut-bindings";
import { presetBinding, type ShortcutPresetId } from "@/stores/shortcut-presets";
import { getShortcutById } from "@/stores/shortcut-registry";

// -- Helpers -------------------------------------------------------------------

// The keys a preset gives a shortcut as it comes, ignoring the user's own changes.
function presetKeysArray(preset: ShortcutPresetId, shortcutId: string): string[] {
  const binding = presetBinding(preset, shortcutId) ?? getShortcutById(shortcutId)?.defaultBinding;
  return binding ? bindingToKeys(binding) : [];
}

// -- Exports -------------------------------------------------------------------

export { presetKeysArray };
