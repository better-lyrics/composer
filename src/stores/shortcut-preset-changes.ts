import { presetBinding, type ShortcutPresetId } from "@/stores/shortcut-presets";
import { SHORTCUT_REGISTRY, type ShortcutBinding } from "@/stores/shortcut-registry";

// -- Types --------------------------------------------------------------------

interface ShortcutChange {
  id: string;
  description: string;
  from: ShortcutBinding;
  to: ShortcutBinding;
}

// -- Helpers ------------------------------------------------------------------

function presetChanges(presetId: ShortcutPresetId): ShortcutChange[] {
  return SHORTCUT_REGISTRY.flatMap(({ id, description, defaultBinding }) => {
    const to = presetBinding(presetId, id);
    return to ? [{ id, description, from: defaultBinding, to }] : [];
  });
}

function ownChanges(presetId: ShortcutPresetId, overrides: Record<string, ShortcutBinding>): ShortcutChange[] {
  return SHORTCUT_REGISTRY.flatMap(({ id, description, defaultBinding }) => {
    const to = overrides[id];
    return to ? [{ id, description, from: presetBinding(presetId, id) ?? defaultBinding, to }] : [];
  });
}

// -- Exports ------------------------------------------------------------------

export type { ShortcutChange };
export { ownChanges, presetChanges };
