import {
  SHORTCUT_DEFINITIONS,
  type ShortcutBinding,
  type ShortcutDefinition,
  type ShortcutScope,
} from "@/stores/shortcut-definitions";

// -- Helpers ------------------------------------------------------------------

const registryMap = new Map<string, ShortcutDefinition>(SHORTCUT_DEFINITIONS.map((d) => [d.id, d]));

function getShortcutById(id: string): ShortcutDefinition | undefined {
  return registryMap.get(id);
}

function getShortcutsByScope(scope: ShortcutScope): ShortcutDefinition[] {
  return SHORTCUT_DEFINITIONS.filter((d) => d.scope === scope);
}

const SHORTCUT_SCOPE_GROUPS: readonly { scope: ShortcutScope; title: string }[] = [
  { scope: "global", title: "General" },
  { scope: "sync", title: "Sync Mode" },
  { scope: "timeline", title: "Timeline Mode" },
];

// -- Exports ------------------------------------------------------------------

export { SHORTCUT_DEFINITIONS as SHORTCUT_REGISTRY, SHORTCUT_SCOPE_GROUPS, getShortcutById, getShortcutsByScope };
export type { ShortcutBinding, ShortcutScope, ShortcutDefinition };
