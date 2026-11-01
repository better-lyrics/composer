import { bindingsEqual, isBound, scopesConflict } from "@/stores/shortcut-binding-compare";
import { presetBinding, type ShortcutPresetId } from "@/stores/shortcut-presets";
import { SHORTCUT_REGISTRY, type ShortcutBinding, getShortcutById } from "@/stores/shortcut-registry";

// -- Helpers ------------------------------------------------------------------

function layoutBinding(preset: ShortcutPresetId, overrides: Record<string, ShortcutBinding>, id: string) {
  return overrides[id] ?? presetBinding(preset, id) ?? getShortcutById(id)?.defaultBinding;
}

// The preset wins a clash: a change that takes one of its keys is dropped, and that action's preset key can push
// out another change in turn, so drop until the layout is clean. Nothing ends up unbound.
function overridesAfterSwitch(
  target: ShortcutPresetId,
  overrides: Record<string, ShortcutBinding>,
  keep: boolean,
): Record<string, ShortcutBinding> {
  if (!keep) return {};
  const kept = { ...overrides };
  for (let clash = layoutClash(target, kept); clash; clash = layoutClash(target, kept)) {
    const dropped = clash.find((id) => id in kept);
    if (!dropped) break;
    delete kept[dropped];
  }
  return kept;
}

function clashingOverrides(target: ShortcutPresetId, overrides: Record<string, ShortcutBinding>): string[] {
  const kept = overridesAfterSwitch(target, overrides, true);
  return Object.keys(overrides).filter((id) => !(id in kept));
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
