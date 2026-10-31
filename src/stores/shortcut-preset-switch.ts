import { bindingsEqual, isBound, scopesConflict } from "@/stores/shortcut-binding-compare";
import { presetBinding, type ShortcutPresetId } from "@/stores/shortcut-presets";
import { SHORTCUT_REGISTRY, type ShortcutBinding, getShortcutById } from "@/stores/shortcut-registry";

// -- Helpers ------------------------------------------------------------------

function layoutBinding(preset: ShortcutPresetId, overrides: Record<string, ShortcutBinding>, id: string) {
  return overrides[id] ?? presetBinding(preset, id) ?? getShortcutById(id)?.defaultBinding;
}

// The preset wins a clash: the change that takes one of its keys is dropped, so nothing ends up unbound.
function clashingOverrides(target: ShortcutPresetId, overrides: Record<string, ShortcutBinding>): string[] {
  return Object.entries(overrides).flatMap(([id, binding]) => {
    const scope = getShortcutById(id)?.scope;
    if (!isBound(binding) || !scope) return [];
    const clashes = SHORTCUT_REGISTRY.some((definition) => {
      if (definition.id === id || overrides[definition.id] || !scopesConflict(scope, definition.scope)) return false;
      const targetKey = layoutBinding(target, {}, definition.id);
      return isBound(targetKey) && bindingsEqual(binding, targetKey);
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

// The first two actions a layout puts on the same key, if any.
function layoutClash(preset: ShortcutPresetId, overrides: Record<string, ShortcutBinding>): [string, string] | null {
  for (const [index, first] of SHORTCUT_REGISTRY.entries()) {
    const firstKey = layoutBinding(preset, overrides, first.id);
    if (!isBound(firstKey)) continue;
    const second = SHORTCUT_REGISTRY.slice(index + 1).find((definition) => {
      const secondKey = layoutBinding(preset, overrides, definition.id);
      return scopesConflict(first.scope, definition.scope) && isBound(secondKey) && bindingsEqual(firstKey, secondKey);
    });
    if (second) return [first.id, second.id];
  }
  return null;
}

// -- Exports ------------------------------------------------------------------

export { clashingOverrides, layoutClash, overridesAfterSwitch };
