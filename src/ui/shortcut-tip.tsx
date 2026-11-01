import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";

// -- Interfaces ----------------------------------------------------------------

interface ShortcutTipProps {
  label: string;
  shortcut?: string;
  description?: string;
}

// -- Components ----------------------------------------------------------------

const ShortcutTip: React.FC<ShortcutTipProps> = ({ label, shortcut, description }) => (
  <span className="flex flex-col items-center gap-0.5">
    <span className="inline-flex items-center whitespace-nowrap">
      {label}
      {shortcut && <InlineKeyBadge keys={getEffectiveKeysArray(shortcut)} />}
    </span>
    {description && <span className="text-(--muted)">{description}</span>}
  </span>
);

// -- Exports -------------------------------------------------------------------

export { ShortcutTip };
