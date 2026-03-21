import { getEffectiveBinding } from "@/stores/shortcut-bindings";
import {
  type ShortcutBinding,
  type ShortcutDefinition,
  type ShortcutScope,
  SHORTCUT_REGISTRY,
  getShortcutsByScope,
} from "@/stores/shortcut-registry";

// -- Matching -----------------------------------------------------------------

function matchesBinding(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const bindingKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key;

  if (eventKey !== bindingKey) return false;
  if (!!binding.shift !== event.shiftKey) return false;
  if (!!binding.alt !== event.altKey) return false;
  if (!!binding.ctrl !== event.ctrlKey) return false;
  if (!!binding.meta !== event.metaKey) return false;

  return true;
}

function findMatchingShortcut(event: KeyboardEvent, scope: ShortcutScope): string | null {
  const shortcuts = getShortcutsByScope(scope);
  for (const shortcut of shortcuts) {
    const binding = getEffectiveBinding(shortcut.id);
    if (matchesBinding(event, binding)) return shortcut.id;
  }
  return null;
}

// -- Conflict Detection -------------------------------------------------------

function bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
  const aKey = a.key.length === 1 ? a.key.toLowerCase() : a.key;
  const bKey = b.key.length === 1 ? b.key.toLowerCase() : b.key;
  return (
    aKey === bKey && !!a.shift === !!b.shift && !!a.alt === !!b.alt && !!a.ctrl === !!b.ctrl && !!a.meta === !!b.meta
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

// -- Reserved Browser Shortcuts -----------------------------------------------

const RESERVED_BROWSER_SHORTCUTS: ShortcutBinding[] = [
  // Tab/window management
  { key: "t", meta: true },
  { key: "t", ctrl: true },
  { key: "n", meta: true },
  { key: "n", ctrl: true },
  { key: "n", meta: true, shift: true },
  { key: "n", ctrl: true, shift: true },
  { key: "w", meta: true },
  { key: "w", ctrl: true },
  { key: "w", meta: true, shift: true },
  { key: "w", ctrl: true, shift: true },
  { key: "Tab", meta: true, alt: true },
  { key: "Tab", ctrl: true },
  { key: "q", meta: true },

  // Navigation
  { key: "l", meta: true },
  { key: "l", ctrl: true },
  { key: "r", meta: true },
  { key: "r", ctrl: true },
  { key: "r", meta: true, shift: true },
  { key: "r", ctrl: true, shift: true },

  // Find
  { key: "f", meta: true },
  { key: "f", ctrl: true },
  { key: "g", meta: true },
  { key: "g", ctrl: true },

  // Page actions
  { key: "p", meta: true },
  { key: "p", ctrl: true },
  { key: "s", meta: true },
  { key: "s", ctrl: true },
  { key: "d", meta: true },
  { key: "d", ctrl: true },

  // Developer tools
  { key: "i", meta: true, alt: true },
  { key: "I", ctrl: true, shift: true },
  { key: "j", meta: true, alt: true },
  { key: "J", ctrl: true, shift: true },
  { key: "u", meta: true },
  { key: "u", ctrl: true },

  // History
  { key: "h", meta: true },
  { key: "h", ctrl: true },
  { key: "[", meta: true },
  { key: "]", meta: true },

  // Zoom
  { key: "=", meta: true },
  { key: "=", ctrl: true },
  { key: "-", meta: true },
  { key: "-", ctrl: true },
  { key: "0", meta: true },
  { key: "0", ctrl: true },
];

function isReservedBrowserShortcut(binding: ShortcutBinding): boolean {
  return RESERVED_BROWSER_SHORTCUTS.some((reserved) => bindingsEqual(reserved, binding));
}

// -- Exports ------------------------------------------------------------------

export { matchesBinding, findMatchingShortcut, detectConflicts, bindingsEqual, isReservedBrowserShortcut };
