import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";

// -- Interfaces ----------------------------------------------------------------

interface ShortcutTipProps {
  label: string;
  shortcut?: string;
  keys?: string[];
  description?: string;
}

// -- Components ----------------------------------------------------------------

const ShortcutTip: React.FC<ShortcutTipProps> = ({ label, shortcut, keys, description }) => {
  const shownKeys = shortcut ? getEffectiveKeysArray(shortcut) : keys;
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center whitespace-nowrap">
        {label}
        {shownKeys && <InlineKeyBadge keys={shownKeys} />}
      </span>
      {description && <span className="text-(--muted)">{description}</span>}
    </span>
  );
};

// -- Exports -------------------------------------------------------------------

export { ShortcutTip };
