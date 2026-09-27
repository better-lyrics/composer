import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type ShortcutBinding, getShortcutById } from "@/stores/shortcut-registry";
import { detectConflicts } from "@/utils/shortcut-matcher";

// -- Types --------------------------------------------------------------------

interface ShortcutBindingsState {
  overrides: Record<string, ShortcutBinding>;
  setBinding: (id: string, binding: ShortcutBinding) => void;
  resetBinding: (id: string) => void;
  resetAllBindings: () => void;
}

// -- Store --------------------------------------------------------------------

const useShortcutBindingsStore = create<ShortcutBindingsState>()(
  persist(
    (set) => ({
      overrides: {},
      setBinding: (id, binding) =>
        set((state) => ({
          overrides: { ...state.overrides, [id]: binding },
        })),
      resetBinding: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.overrides;
          return { overrides: rest };
        }),
      resetAllBindings: () => set({ overrides: {} }),
    }),
    { name: "composer-shortcut-bindings" },
  ),
);

// -- Helpers ------------------------------------------------------------------

const UNBOUND: ShortcutBinding = { key: "" };

function getEffectiveBinding(id: string): ShortcutBinding {
  const override = useShortcutBindingsStore.getState().overrides[id];
  if (override) return override;
  const def = getShortcutById(id);
  if (!def) throw new Error(`Unknown shortcut: ${id}`);
  return def.defaultBinding;
}

function assignBinding(id: string, binding: ShortcutBinding): void {
  const unbound = Object.fromEntries(detectConflicts(id, binding).map((conflict) => [conflict.id, UNBOUND]));
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
  useShortcutBindingsStore,
  assignBinding,
  bindingToKeys,
  getEffectiveBinding,
  getEffectiveKeysArray,
  getShortcutDescription,
};
