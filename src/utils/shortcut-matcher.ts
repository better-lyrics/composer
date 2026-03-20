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
  return aKey === bKey && !!a.shift === !!b.shift && !!a.alt === !!b.alt;
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

// -- Exports ------------------------------------------------------------------

export { matchesBinding, findMatchingShortcut, detectConflicts, bindingsEqual };
