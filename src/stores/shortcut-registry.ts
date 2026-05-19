import { SHORTCUT_DEFINITIONS } from "@/stores/shortcut-definitions";

// -- Types --------------------------------------------------------------------

interface ShortcutBinding {
  key: string;
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  mod?: boolean;
}

type ShortcutScope = "global" | "sync" | "timeline";

interface ShortcutDefinition {
  id: string;
  scope: ShortcutScope;
  description: string;
  defaultBinding: ShortcutBinding;
}

// -- Registry -----------------------------------------------------------------

const SHORTCUT_REGISTRY: ShortcutDefinition[] = SHORTCUT_DEFINITIONS;

// -- Helpers ------------------------------------------------------------------

const registryMap = new Map<string, ShortcutDefinition>(SHORTCUT_REGISTRY.map((d) => [d.id, d]));

function getShortcutById(id: string): ShortcutDefinition | undefined {
  return registryMap.get(id);
}

function getShortcutsByScope(scope: ShortcutScope): ShortcutDefinition[] {
  return SHORTCUT_REGISTRY.filter((d) => d.scope === scope);
}

// -- Exports ------------------------------------------------------------------

export { SHORTCUT_REGISTRY, getShortcutById, getShortcutsByScope };
export type { ShortcutBinding, ShortcutScope, ShortcutDefinition };
