import { formatKey } from "@/ui/help-modal";
import { isMac } from "@/utils/platform";
import { IconCommand } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface InlineKeyBadgeProps {
  keys: string[];
}

// -- Component ----------------------------------------------------------------

const InlineKeyBadge: React.FC<InlineKeyBadgeProps> = ({ keys }) => (
  <span className="inline-flex items-center gap-0.5 ml-1.5">
    {keys.map((key, i) => (
      <span
        // biome-ignore lint/suspicious/noArrayIndexKey: key order is fixed
        key={`${key}-${i}`}
        className="inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-medium rounded bg-white/10 text-composer-text-muted leading-none shadow-[0_2px_0_0_rgba(0,0,0,0.3)]"
      >
        {key === "Mod" && isMac ? <IconCommand className="w-2.5 h-2.5" /> : formatKey(key)}
      </span>
    ))}
  </span>
);

// -- Exports ------------------------------------------------------------------

export { InlineKeyBadge };
