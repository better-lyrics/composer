import { bindingsEqual, getEffectiveBinding } from "@/stores/shortcut-bindings";
import { type ShortcutBinding, type ShortcutScope, getShortcutsByScope } from "@/stores/shortcut-registry";
import { isMac } from "@/utils/platform";
import { US_PUNCTUATION_BY_CODE } from "@/utils/us-punctuation";

// -- Matching -----------------------------------------------------------------

function physicalKey(event: KeyboardEvent): string | null {
  const { code, shiftKey } = event;
  if (code.startsWith("Key") && code.length === 4) return code.slice(3).toLowerCase();
  const punctuation = US_PUNCTUATION_BY_CODE[code];
  return punctuation ? punctuation[shiftKey ? 1 : 0] : null;
}

function isNonLatinLetter(key: string): boolean {
  return key.length === 1 && /\p{L}/u.test(key) && !/\p{Script=Latin}/u.test(key);
}

// Layout glyphs (Option on macOS: Alt+E → "´"; non-Latin layouts: E → "у")
// fall back to the physical key so bindings match on any layout.
function getEventKey(event: KeyboardEvent): string {
  if (event.altKey) {
    if (event.code.startsWith("Key") && event.code.length === 4) return event.code.slice(3).toLowerCase();
    if (event.code.startsWith("Digit") && event.code.length === 6) return event.code.slice(5);
  }
  if (isNonLatinLetter(event.key)) return physicalKey(event) ?? event.key;
  // Chrome and Safari on macOS can drop Shift from event.key while Cmd is held (Cmd+Shift+, reads ",").
  const punctuation = US_PUNCTUATION_BY_CODE[event.code];
  if (event.shiftKey && punctuation && event.key === punctuation[0]) return punctuation[1];
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

const MODIFIER_KEYS = new Set([
  "Shift",
  "Alt",
  "Control",
  "Meta",
  "AltGraph",
  "CapsLock",
  "Fn",
  "FnLock",
  "Hyper",
  "Super",
  "OS",
]);
const NAMED_BINDABLE_KEYS = new Set([
  "Enter",
  "Tab",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);
const FUNCTION_KEY = /^F([1-9]|1\d|2[0-4])$/;

function isBindableKey(key: string): boolean {
  return key.length === 1 || NAMED_BINDABLE_KEYS.has(key) || FUNCTION_KEY.test(key);
}

function bindingFromKeyboardEvent(event: KeyboardEvent): ShortcutBinding | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  const key = getEventKey(event);
  if (!isBindableKey(key)) return null;
  const modPressed = isMac ? event.metaKey : event.ctrlKey;
  const rawCtrl = isMac && event.ctrlKey;
  const rawMeta = !isMac && event.metaKey;
  return {
    key,
    ...(event.shiftKey && { shift: true }),
    ...(event.altKey && { alt: true }),
    ...(modPressed && { mod: true }),
    ...(rawCtrl && { ctrl: true }),
    ...(rawMeta && { meta: true }),
  };
}

function reportedBinding(event: KeyboardEvent, binding: ShortcutBinding): ShortcutBinding | undefined {
  const reportedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return reportedKey === binding.key ? undefined : { ...binding, key: reportedKey };
}

function matchesBinding(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  if (binding.key === "") return false;
  if (event.getModifierState("AltGraph")) return false;
  const bindingKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key;
  const reportedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (getEventKey(event) !== bindingKey && reportedKey !== bindingKey) return false;
  if (!!binding.shift !== event.shiftKey) return false;
  if (!!binding.alt !== event.altKey) return false;

  if (binding.mod) {
    const modActive = isMac ? event.metaKey : event.ctrlKey;
    if (!modActive) return false;
    return true;
  }

  if (!!binding.ctrl !== event.ctrlKey) return false;
  if (!!binding.meta !== event.metaKey) return false;

  return true;
}

function findMatchingShortcut(event: KeyboardEvent, scope: ShortcutScope): string | null {
  const shortcuts = getShortcutsByScope(scope);
  for (const shortcut of shortcuts) {
    const binding = getEffectiveBinding(shortcut.id);
    if (matchesBinding(event, binding)) return event.repeat && !shortcut.repeatable ? null : shortcut.id;
  }
  return null;
}

function isCommandBinding(binding: ShortcutBinding): boolean {
  return !!(binding.mod || binding.ctrl || binding.meta);
}

function matchesShortcutBinding(event: KeyboardEvent, id: string): boolean {
  return matchesBinding(event, getEffectiveBinding(id));
}

// -- Reserved Browser Shortcuts -----------------------------------------------

const RESERVED_BROWSER_SHORTCUTS: ShortcutBinding[] = [
  // Tab/window management
  { key: "t", mod: true },
  { key: "n", mod: true },
  { key: "n", mod: true, shift: true },
  { key: "w", mod: true },
  { key: "w", mod: true, shift: true },
  { key: "Tab", ctrl: true },
  ...(isMac ? [{ key: "Tab", meta: true, alt: true }] : []),
  ...(isMac ? [{ key: "q", meta: true }] : []),

  // Navigation
  { key: "l", mod: true },
  { key: "r", mod: true },
  { key: "r", mod: true, shift: true },

  // Find
  { key: "f", mod: true },
  { key: "g", mod: true },

  // Page actions
  { key: "p", mod: true },
  { key: "d", mod: true },

  // Developer tools
  ...(isMac
    ? [
        { key: "i", meta: true, alt: true },
        { key: "j", meta: true, alt: true },
      ]
    : [
        { key: "I", ctrl: true, shift: true },
        { key: "J", ctrl: true, shift: true },
      ]),
  { key: "u", mod: true },

  // History
  ...(isMac
    ? [
        { key: "h", meta: true },
        { key: "[", meta: true },
        { key: "]", meta: true },
      ]
    : [{ key: "h", ctrl: true }]),

  // Zoom
  { key: "=", mod: true },
  { key: "-", mod: true },
  { key: "0", mod: true },
];

function isReservedBrowserShortcut(binding: ShortcutBinding): boolean {
  return RESERVED_BROWSER_SHORTCUTS.some((reserved) => bindingsEqual(reserved, binding));
}

// -- Exports ------------------------------------------------------------------

export {
  reportedBinding,
  bindingFromKeyboardEvent,
  findMatchingShortcut,
  isCommandBinding,
  isReservedBrowserShortcut,
  matchesShortcutBinding,
};
