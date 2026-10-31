import { bindingsEqual, isBound, scopesConflict } from "@/stores/shortcut-binding-compare";
import { getShortcutById, SHORTCUT_REGISTRY, type ShortcutBinding } from "@/stores/shortcut-registry";
import { isMac } from "@/utils/platform";
import { shiftedUsPunctuation } from "@/utils/us-punctuation";

// -- Types --------------------------------------------------------------------

interface SavedBindings {
  overrides?: Record<string, ShortcutBinding>;
}

// -- Migration ----------------------------------------------------------------

const UNBOUND: ShortcutBinding = { key: "" };

const ALTERNATE_REDO_ID = "global.redoAlternate";
const DELETE_SELECTION_IDS = ["timeline.deleteSelection", "timeline.deleteSelectionAlternate"];
const CLIPBOARD_IDS = ["timeline.copy", "timeline.cut", "timeline.paste"];

type SameKeys = (saved: ShortcutBinding, added: ShortcutBinding) => boolean;

function unbindIfKeysTaken(
  overrides: Record<string, ShortcutBinding>,
  addedId: string,
  sameKeys: SameKeys,
): Record<string, ShortcutBinding> {
  const added = getShortcutById(addedId);
  if (!added || overrides[addedId]) return overrides;
  const keysTaken = Object.entries(overrides).some(([id, binding]) => {
    const owner = getShortcutById(id);
    return (
      owner !== undefined &&
      scopesConflict(added.scope, owner.scope) &&
      typeof binding?.key === "string" &&
      sameKeys(binding, added.defaultBinding)
    );
  });
  return keysTaken ? { ...overrides, [addedId]: UNBOUND } : overrides;
}

function unbindTakenKeys(addedIds: string[], sameKeys: SameKeys = bindingsEqual) {
  return (state: SavedBindings): SavedBindings => {
    const { overrides } = state;
    if (!overrides || typeof overrides !== "object") return state;
    const migrated = addedIds.reduce((current, addedId) => unbindIfKeysTaken(current, addedId, sameKeys), overrides);
    return migrated === overrides ? state : { ...state, overrides: migrated };
  };
}

const unbindTakenDeleteKeys = unbindTakenKeys(DELETE_SELECTION_IDS);
const unbindTakenClipboardKeys = unbindTakenKeys(CLIPBOARD_IDS);
const unbindTakenTypingPlayKeys = unbindTakenKeys(["global.playPauseWhileTyping"]);
// Chrome and Safari on macOS saved Cmd+Shift+. as ".", which the ">" seek default also matches.
function samePressOnMac(saved: ShortcutBinding, added: ShortcutBinding): boolean {
  const droppedShift = isMac && saved.shift && (saved.mod || saved.meta);
  const shiftedKey = droppedShift ? shiftedUsPunctuation(saved.key) : undefined;
  return (
    bindingsEqual(saved, added) || (shiftedKey !== undefined && bindingsEqual({ ...saved, key: shiftedKey }, added))
  );
}

const unbindTakenSeekKeys = unbindTakenKeys(
  ["global.seekBackward", "global.seekForward", "global.seekBackwardWhileTyping", "global.seekForwardWhileTyping"],
  samePressOnMac,
);

// Before 7, macOS saved Option+Shift+, and . as the glyphs they type.
const MAC_OPTION_SHIFT_GLYPHS: Record<string, string> = { "\u00af": "<", "\u02d8": ">" };
function sameOptionPressOnMac(saved: ShortcutBinding, added: ShortcutBinding): boolean {
  const physicalKey = isMac && saved.alt && saved.shift ? MAC_OPTION_SHIFT_GLYPHS[saved.key] : undefined;
  return (
    bindingsEqual(saved, added) || (physicalKey !== undefined && bindingsEqual({ ...saved, key: physicalKey }, added))
  );
}

const unbindTakenFineSeekKeys = unbindTakenKeys(
  [
    "global.seekBackwardFine",
    "global.seekForwardFine",
    "global.seekBackwardFineWhileTyping",
    "global.seekForwardFineWhileTyping",
  ],
  sameOptionPressOnMac,
);

const RENAMED_SHORTCUT_IDS: Record<string, string> = { "timeline.toggleGroupLoop": "global.toggleLoop" };

function unbindTakenAlternateRedo(state: SavedBindings): SavedBindings {
  const { overrides } = state;
  const alternateRedo = getShortcutById(ALTERNATE_REDO_ID);
  if (!overrides || typeof overrides !== "object" || !alternateRedo || overrides[ALTERNATE_REDO_ID]) return state;
  const keysTaken = Object.values(overrides).some(
    (binding) => typeof binding?.key === "string" && bindingsEqual(binding, alternateRedo.defaultBinding),
  );
  if (!keysTaken) return state;
  return { ...state, overrides: { ...overrides, [ALTERNATE_REDO_ID]: UNBOUND } };
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
function renameShortcutIds(state: SavedBindings): SavedBindings {
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

function migrateSavedOverrides(persistedState: unknown, version: number): unknown {
  if (!persistedState || typeof persistedState !== "object") return persistedState;
  const state = persistedState as SavedBindings;
  const withRedo = version < 1 ? unbindTakenAlternateRedo(state) : state;
  const renamed = version < 2 ? renameShortcutIds(withRedo) : withRedo;
  const withDeleteKeys = version < 3 ? unbindTakenDeleteKeys(renamed) : renamed;
  const withClipboardKeys = version < 4 ? unbindTakenClipboardKeys(withDeleteKeys) : withDeleteKeys;
  const withTypingPlayKeys = version < 5 ? unbindTakenTypingPlayKeys(withClipboardKeys) : withClipboardKeys;
  const withSeekKeys = version < 6 ? unbindTakenSeekKeys(withTypingPlayKeys) : withTypingPlayKeys;
  return version < 7 ? unbindTakenFineSeekKeys(withSeekKeys) : withSeekKeys;
}

// -- Exports ------------------------------------------------------------------

export type { SavedBindings };
export { migrateSavedOverrides, UNBOUND };
