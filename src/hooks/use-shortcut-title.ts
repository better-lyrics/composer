import { getEffectiveKeysArray, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { formatShortcut } from "@/utils/format-key";

// -- Hooks ---------------------------------------------------------------------

function useShortcutTitle(label: string, shortcutId: string): string {
  const keys = useShortcutBindingsStore(() => formatShortcut(getEffectiveKeysArray(shortcutId)));
  return keys ? `${label} (${keys})` : label;
}

// -- Exports -------------------------------------------------------------------

export { useShortcutTitle };
