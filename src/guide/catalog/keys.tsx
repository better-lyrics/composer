import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";

// -- Helpers ------------------------------------------------------------------

// Copy carries its own spaces, so a badge that opens a sentence sits flush with the title above.

const keyBadge = (...names: string[]) => <InlineKeyBadge keys={names} className="ml-0" />;

const keys = (shortcutId: string) => keyBadge(...getEffectiveKeysArray(shortcutId));

// -- Exports ------------------------------------------------------------------

export { keyBadge, keys };
