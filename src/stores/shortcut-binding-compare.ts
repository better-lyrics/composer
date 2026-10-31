import type { ShortcutBinding, ShortcutScope } from "@/stores/shortcut-registry";

// -- Helpers ------------------------------------------------------------------

function keyIdentity(binding: ShortcutBinding): string {
  return binding.key.length === 1 ? binding.key.toLowerCase() : binding.key;
}

function bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
  return (
    keyIdentity(a) === keyIdentity(b) &&
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

function isBound(binding: ShortcutBinding | undefined): binding is ShortcutBinding {
  return typeof binding?.key === "string" && binding.key !== "";
}

// -- Exports ------------------------------------------------------------------

export { bindingsEqual, isBound, scopesConflict };
