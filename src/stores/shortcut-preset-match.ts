import { bindingsEqual } from "@/stores/shortcut-binding-compare";
import { SHORTCUT_PRESETS, type ShortcutPreset, type ShortcutPresetId } from "@/stores/shortcut-presets";
import { getShortcutById, type ShortcutBinding } from "@/stores/shortcut-registry";

// -- Types --------------------------------------------------------------------

interface PresetMatch {
  preset: ShortcutPresetId;
  overrides: Record<string, ShortcutBinding>;
}

// -- Helpers ------------------------------------------------------------------

function overridesOnPreset(preset: ShortcutPreset, overrides: Record<string, ShortcutBinding>) {
  const kept = Object.fromEntries(
    Object.entries(overrides).filter(([id, binding]) => {
      const fromPreset = preset.bindings[id];
      return !fromPreset || !bindingsEqual(binding, fromPreset);
    }),
  );
  for (const [id, fromPreset] of Object.entries(preset.bindings)) {
    const composerKey = getShortcutById(id)?.defaultBinding;
    if (!overrides[id] && composerKey && !bindingsEqual(composerKey, fromPreset)) kept[id] = composerKey;
  }
  return kept;
}

// The preset that leaves the fewest own changes wins, so every key stays where it was.
function presetForOverrides(overrides: Record<string, ShortcutBinding>): PresetMatch {
  const [best] = SHORTCUT_PRESETS.map((preset) => ({ preset, kept: overridesOnPreset(preset, overrides) })).toSorted(
    (a, b) =>
      Object.keys(a.kept).length - Object.keys(b.kept).length ||
      Object.keys(a.preset.bindings).length - Object.keys(b.preset.bindings).length,
  );
  return { preset: best.preset.id, overrides: best.kept };
}

// -- Exports ------------------------------------------------------------------

export { presetForOverrides };
