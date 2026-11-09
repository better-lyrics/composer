import { getEffectiveKeysArray, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";

// -- Components ---------------------------------------------------------------

// Copy carries its own spaces, so a badge that opens a sentence sits flush with the title above.
const keyBadge = (...names: string[]) => <InlineKeyBadge keys={names} className="ml-0" />;

// Catalog copy is built once at load, so the badge reads the binding at render to follow every rebind.
const ShortcutKeys: React.FC<{ shortcutId: string }> = ({ shortcutId }) => {
  useShortcutBindingsStore((state) => state.overrides[shortcutId] ?? state.preset);
  return keyBadge(...getEffectiveKeysArray(shortcutId));
};

const keys = (shortcutId: string) => <ShortcutKeys shortcutId={shortcutId} />;

// -- Exports ------------------------------------------------------------------

export { keyBadge, keys };
