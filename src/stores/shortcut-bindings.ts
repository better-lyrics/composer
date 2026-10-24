import {
  SHORTCUT_REGISTRY,
  type ShortcutBinding,
  type ShortcutDefinition,
  type ShortcutScope,
  getShortcutById,
} from "@/stores/shortcut-registry";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// -- Types --------------------------------------------------------------------

interface ShortcutBindingsState {
  overrides: Record<string, ShortcutBinding>;
  resetBinding: (id: string) => void;
  resetAllBindings: () => void;
}

// -- Migration ----------------------------------------------------------------

const SHORTCUT_BINDINGS_PERSIST_VERSION = 5;
const UNBOUND: ShortcutBinding = { key: "" };

const ALTERNATE_REDO_ID = "global.redoAlternate";
const DELETE_SELECTION_IDS = ["timeline.deleteSelection", "timeline.deleteSelectionAlternate"];
const CLIPBOARD_IDS = ["timeline.copy", "timeline.cut", "timeline.paste"];

function unbindIfKeysTaken(
  overrides: Record<string, ShortcutBinding>,
  addedId: string,
): Record<string, ShortcutBinding> {
  const added = getShortcutById(addedId);
  if (!added || overrides[addedId]) return overrides;
  const keysTaken = Object.entries(overrides).some(([id, binding]) => {
    const owner = getShortcutById(id);
    return (
      owner !== undefined &&
      scopesConflict(added.scope, owner.scope) &&
      typeof binding?.key === "string" &&
      bindingsEqual(binding, added.defaultBinding)
    );
  });
  return keysTaken ? { ...overrides, [addedId]: UNBOUND } : overrides;
}

function unbindTakenKeys(addedIds: string[]) {
  return (state: Partial<ShortcutBindingsState>): Partial<ShortcutBindingsState> => {
    const { overrides } = state;
    if (!overrides || typeof overrides !== "object") return state;
    const migrated = addedIds.reduce(unbindIfKeysTaken, overrides);
    return migrated === overrides ? state : { ...state, overrides: migrated };
  };
}

const unbindTakenDeleteKeys = unbindTakenKeys(DELETE_SELECTION_IDS);
const unbindTakenClipboardKeys = unbindTakenKeys(CLIPBOARD_IDS);
const unbindTakenTypingPlayKeys = unbindTakenKeys(["global.playPauseWhileTyping"]);

const RENAMED_SHORTCUT_IDS: Record<string, string> = { "timeline.toggleGroupLoop": "global.toggleLoop" };

function unbindTakenAlternateRedo(state: Partial<ShortcutBindingsState>): Partial<ShortcutBindingsState> {
  const { overrides } = state;
  const alternateRedo = getShortcutById(ALTERNATE_REDO_ID);
  if (!overrides || typeof overrides !== "object" || !alternateRedo || overrides[ALTERNATE_REDO_ID]) return state;
  const keysTaken = Object.values(overrides).some(
    (binding) => typeof binding?.key === "string" && bindingsEqual(binding, alternateRedo.defaultBinding),
  );
  if (!keysTaken) return state;
  return { ...state, overrides: { ...overrides, [ALTERNATE_REDO_ID]: UNBOUND } };
}

function isBound(binding: ShortcutBinding | undefined): binding is ShortcutBinding {
  return typeof binding?.key === "string" && binding.key !== "";
}

function clashesWithAnotherBinding(
  id: string,
  binding: ShortcutBinding,
  overrides: Record<string, ShortcutBinding>,
): boolean {
  const scope = getShortcutById(id)?.scope;
  return SHORTCUT_REGISTRY.some((definition) => {
    if (definition.id === id || !scope || !scopesConflict(scope, definition.scope)) return false;
    const other = overrides[definition.id] ?? definition.defaultBinding;
    return isBound(other) && bindingsEqual(other, binding);
  });
}

// A renamed id can land in a wider scope, so a binding that was legal before may now clash: a clashing override
// falls back to the default, and a clashing default is unbound. A deliberate unbind stays.
function renameShortcutIds(state: Partial<ShortcutBindingsState>): Partial<ShortcutBindingsState> {
  const { overrides } = state;
  if (!overrides || typeof overrides !== "object") return state;
  const renamed: Record<string, ShortcutBinding> = Object.fromEntries(
    Object.entries(overrides).map(([id, binding]) => [RENAMED_SHORTCUT_IDS[id] ?? id, binding]),
  );
  for (const newId of Object.values(RENAMED_SHORTCUT_IDS)) {
    const override = renamed[newId];
    if (isBound(override) && clashesWithAnotherBinding(newId, override, renamed)) delete renamed[newId];
    const fallback = getShortcutById(newId)?.defaultBinding;
    const deliberatelyUnbound = renamed[newId]?.key === "";
    if (
      !isBound(renamed[newId]) &&
      !deliberatelyUnbound &&
      fallback &&
      clashesWithAnotherBinding(newId, fallback, renamed)
    ) {
      renamed[newId] = UNBOUND;
    }
  }
  return { ...state, overrides: renamed };
}

function migrateShortcutBindings(persistedState: unknown, version: number): unknown {
  if (!persistedState || typeof persistedState !== "object") return persistedState;
  const state = persistedState as Partial<ShortcutBindingsState>;
  const withRedo = version < 1 ? unbindTakenAlternateRedo(state) : state;
  const renamed = version < 2 ? renameShortcutIds(withRedo) : withRedo;
  const withDeleteKeys = version < 3 ? unbindTakenDeleteKeys(renamed) : renamed;
  const withClipboardKeys = version < 4 ? unbindTakenClipboardKeys(withDeleteKeys) : withDeleteKeys;
  return version < 5 ? unbindTakenTypingPlayKeys(withClipboardKeys) : withClipboardKeys;
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
    {
      name: "composer-shortcut-bindings",
      version: SHORTCUT_BINDINGS_PERSIST_VERSION,
      migrate: migrateShortcutBindings,
    },
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
