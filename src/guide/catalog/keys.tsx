import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";

// -- Helpers ------------------------------------------------------------------

const keys = (shortcutId: string) => <InlineKeyBadge keys={getEffectiveKeysArray(shortcutId)} />;

// -- Exports ------------------------------------------------------------------

export { keys };
