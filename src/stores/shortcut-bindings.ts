import { create } from "zustand";
import { persist } from "zustand/middleware";
import { bindingsEqual, scopesConflict } from "@/stores/shortcut-binding-compare";
import { migrateShortcutBindings, UNBOUND } from "@/stores/shortcut-bindings-migration";
import { DEFAULT_SHORTCUT_PRESET, presetBinding, type ShortcutPresetId } from "@/stores/shortcut-presets";
import {
  getShortcutById,
  SHORTCUT_REGISTRY,
  type ShortcutBinding,
  type ShortcutDefinition,
} from "@/stores/shortcut-registry";

// -- Types --------------------------------------------------------------------

interface ShortcutBindingsState {
  overrides: Record<string, ShortcutBinding>;
  preset: ShortcutPresetId;
  setPreset: (preset: ShortcutPresetId, overrides: Record<string, ShortcutBinding>) => void;
  presetIntroPending: boolean;
  dismissPresetIntro: () => void;
  spaceHintAnswered: boolean;
  answerSpaceHint: () => void;
  resetBinding: (id: string) => void;
  resetAllBindings: () => void;
}

// -- Constants ----------------------------------------------------------------

const SHORTCUT_BINDINGS_PERSIST_VERSION = 8;

// -- Store --------------------------------------------------------------------

const useShortcutBindingsStore = create<ShortcutBindingsState>()(
  persist(
    (set) => ({
      overrides: {},
      preset: DEFAULT_SHORTCUT_PRESET,
      setPreset: (preset, overrides) => set({ preset, overrides, spaceHintAnswered: true }),
      presetIntroPending: false,
      dismissPresetIntro: () => set({ presetIntroPending: false }),
      spaceHintAnswered: false,
      answerSpaceHint: () => set({ spaceHintAnswered: true }),
      resetBinding: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.overrides;
          return { overrides: rest };
        }),
      resetAllBindings: () => set({ overrides: {} }),
    }),
    {
      name: "composer-shortcut-bindings",
      version: SHORTCUT_BINDINGS_PERSIST_VERSION,
      migrate: migrateShortcutBindings,
    },
  ),
);

// -- Helpers ------------------------------------------------------------------

function getEffectiveBinding(id: string): ShortcutBinding {
  const { overrides, preset } = useShortcutBindingsStore.getState();
  const override = overrides[id];
  if (override) return override;
  const fromPreset = presetBinding(preset, id);
  if (fromPreset) return fromPreset;
  const def = getShortcutById(id);
  if (!def) throw new Error(`Unknown shortcut: ${id}`);
  return def.defaultBinding;
}

// -- Conflict Detection -------------------------------------------------------

// `pressedAs` is the same key press as the browser reported it, when that differs from the recorded binding.
function detectConflicts(id: string, newBinding: ShortcutBinding, pressedAs?: ShortcutBinding): ShortcutDefinition[] {
  const source = SHORTCUT_REGISTRY.find((d) => d.id === id);
  if (!source) return [];

  return SHORTCUT_REGISTRY.filter((def) => {
    if (def.id === id) return false;
    if (!scopesConflict(source.scope, def.scope)) return false;
    const effective = getEffectiveBinding(def.id);
    return bindingsEqual(effective, newBinding) || (pressedAs !== undefined && bindingsEqual(effective, pressedAs));
  });
}

function assignBinding(id: string, binding: ShortcutBinding, pressedAs?: ShortcutBinding): void {
  const conflicts = detectConflicts(id, binding, pressedAs);
  const unbound = Object.fromEntries(conflicts.map((conflict) => [conflict.id, UNBOUND]));
  useShortcutBindingsStore.setState((state) => ({ overrides: { ...state.overrides, ...unbound, [id]: binding } }));
}

function bindingToKeys(binding: ShortcutBinding): string[] {
  if (binding.key === "") return [];
  const keys: string[] = [];
  if (binding.mod) keys.push("Mod");
  if (binding.meta) keys.push("Meta");
  if (binding.ctrl) keys.push("Ctrl");
  if (binding.shift) keys.push("Shift");
  if (binding.alt) keys.push("Alt");
  const rawKey = binding.key === " " ? "Space" : binding.key;
  const displayKey = rawKey.length === 1 ? rawKey.toUpperCase() : rawKey;
  keys.push(displayKey);
  return keys;
}

function getEffectiveKeysArray(id: string): string[] {
  return bindingToKeys(getEffectiveBinding(id));
}

function getShortcutDescription(id: string): string {
  return getShortcutById(id)?.description ?? id;
}

// -- Exports ------------------------------------------------------------------

export {
  assignBinding,
  bindingToKeys,
  detectConflicts,
  getEffectiveBinding,
  getEffectiveKeysArray,
  getShortcutDescription,
  useShortcutBindingsStore,
};
