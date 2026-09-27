import { bindingsEqual, getEffectiveBinding } from "@/stores/shortcut-bindings";
import { type ShortcutBinding, type ShortcutScope, getShortcutsByScope } from "@/stores/shortcut-registry";
import { isMac } from "@/utils/platform";

// -- Matching -----------------------------------------------------------------

// On macOS, holding Option/Alt rewrites `event.key` to the layout-specific
// glyph (Alt+E → "´", Alt+Shift+E → "´") instead of the base letter. Fall back
// to `event.code` (e.g., "KeyE", "Digit1") which reflects the physical key
// regardless of modifiers, so alt-bearing bindings still match.
function getEventKey(event: KeyboardEvent): string {
  if (event.altKey) {
    if (event.code.startsWith("Key") && event.code.length === 4) return event.code.slice(3).toLowerCase();
    if (event.code.startsWith("Digit") && event.code.length === 6) return event.code.slice(5);
  }
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

function matchesBinding(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  if (binding.key === "") return false;
  const eventKey = getEventKey(event);
  const bindingKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key;

  if (eventKey !== bindingKey) return false;
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
  { key: "s", mod: true },
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

export { bindingFromKeyboardEvent, findMatchingShortcut, isReservedBrowserShortcut };
