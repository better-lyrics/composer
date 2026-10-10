import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type ShortcutBinding,
  type ShortcutDefinition,
  type ShortcutScope,
  SHORTCUT_REGISTRY,
  getShortcutById,
} from "@/stores/shortcut-registry";

// -- Types --------------------------------------------------------------------

interface ShortcutBindingsState {
  overrides: Record<string, ShortcutBinding>;
  resetBinding: (id: string) => void;
  resetAllBindings: () => void;
}

// -- Migration ----------------------------------------------------------------

const SHORTCUT_BINDINGS_PERSIST_VERSION = 1;
const UNBOUND: ShortcutBinding = { key: "" };
const ALTERNATE_REDO_ID = "global.redoAlternate";

function migrateShortcutBindings(persistedState: unknown, version: number): unknown {
  if (version >= 1 || !persistedState || typeof persistedState !== "object") return persistedState;
  const { overrides } = persistedState as Partial<ShortcutBindingsState>;
  const alternateRedo = getShortcutById(ALTERNATE_REDO_ID);
  if (!overrides || typeof overrides !== "object" || !alternateRedo || overrides[ALTERNATE_REDO_ID]) {
    return persistedState;
  }
  const keysTaken = Object.values(overrides).some(
    (binding) => typeof binding?.key === "string" && bindingsEqual(binding, alternateRedo.defaultBinding),
  );
  if (!keysTaken) return persistedState;
  return { ...persistedState, overrides: { ...overrides, [ALTERNATE_REDO_ID]: UNBOUND } };
}

// -- Store --------------------------------------------------------------------

const useShortcutBindingsStore = create<ShortcutBindingsState>()(
  persist(
    (set) => ({
      overrides: {},
      resetBinding: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.overrides;
          return { overrides: rest };
        }),
      resetAllBindings: () => set({ overrides: {} }),
    }),
    { name: "composer-shortcut-bindings", version: SHORTCUT_BINDINGS_PERSIST_VERSION, migrate: migrateShortcutBindings },
  ),
);

// -- Helpers ------------------------------------------------------------------

function getEffectiveBinding(id: string): ShortcutBinding {
  const override = useShortcutBindingsStore.getState().overrides[id];
  if (override) return override;
  const def = getShortcutById(id);
  if (!def) throw new Error(`Unknown shortcut: ${id}`);
  return def.defaultBinding;
}

// -- Conflict Detection -------------------------------------------------------

function bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
  const aKey = a.key.length === 1 ? a.key.toLowerCase() : a.key;
  const bKey = b.key.length === 1 ? b.key.toLowerCase() : b.key;
  return (
    aKey === bKey &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt &&
    !!a.ctrl === !!b.ctrl &&
    !!a.meta === !!b.meta &&
    !!a.mod === !!b.mod
  );
}

function scopesConflict(a: ShortcutScope, b: ShortcutScope): boolean {
  if (a === "global" || b === "global") return true;
  return a === b;
}

function detectConflicts(id: string, newBinding: ShortcutBinding): ShortcutDefinition[] {
  const source = SHORTCUT_REGISTRY.find((d) => d.id === id);
  if (!source) return [];

  return SHORTCUT_REGISTRY.filter((def) => {
    if (def.id === id) return false;
    if (!scopesConflict(source.scope, def.scope)) return false;
    const effective = getEffectiveBinding(def.id);
    return bindingsEqual(effective, newBinding);
  });
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
  migrateShortcutBindings,
  assignBinding,
  bindingsEqual,
  bindingToKeys,
  detectConflicts,
  getEffectiveBinding,
  getEffectiveKeysArray,
  getShortcutDescription,
};
