import { bindingsEqual, isBound, scopesConflict } from "@/stores/shortcut-binding-compare";
import { type ShortcutPresetId, shortcutPreset } from "@/stores/shortcut-presets";
import { getShortcutById, type ShortcutBinding } from "@/stores/shortcut-registry";

// -- Helpers ------------------------------------------------------------------

// The preset wins a clash: the change that takes one of its keys is dropped, so nothing ends up unbound.
function clashingOverrides(target: ShortcutPresetId, overrides: Record<string, ShortcutBinding>): string[] {
  const presetEntries = Object.entries(shortcutPreset(target).bindings).filter(([id]) => !overrides[id]);
  return Object.entries(overrides).flatMap(([id, binding]) => {
    const scope = getShortcutById(id)?.scope;
    const clashes =
      isBound(binding) &&
      scope !== undefined &&
      presetEntries.some(([presetId, presetKey]) => {
        const presetScope = getShortcutById(presetId)?.scope;
        return presetScope !== undefined && scopesConflict(scope, presetScope) && bindingsEqual(binding, presetKey);
      });
    return clashes ? [id] : [];
  });
}

function overridesAfterSwitch(
  target: ShortcutPresetId,
  overrides: Record<string, ShortcutBinding>,
  keep: boolean,
): Record<string, ShortcutBinding> {
  if (!keep) return {};
  const clashing = new Set(clashingOverrides(target, overrides));
  return Object.fromEntries(Object.entries(overrides).filter(([id]) => !clashing.has(id)));
}

// -- Exports ------------------------------------------------------------------

export { clashingOverrides, overridesAfterSwitch };
