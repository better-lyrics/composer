import { formatKey } from "@/utils/format-key";
import { isMac } from "@/utils/platform";
import { IconCommand } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface InlineKeyBadgeProps {
  keys?: string[];
  text?: string;
}

// -- Component ----------------------------------------------------------------

const InlineKeyBadge: React.FC<InlineKeyBadgeProps> = ({ keys, text }) => {
  if (text !== undefined) {
    return (
      <span
        data-inline-key-badge
        className="inline-flex items-center h-5 px-1.5 text-xs font-medium rounded-[5px] bg-composer-button text-composer-text-muted"
      >
        {text}
      </span>
    );
  }
  const resolvedKeys = keys ?? [];
  if (resolvedKeys.length === 0) {
    return (
      <span
        data-inline-key-badge
        className="inline-flex items-center justify-center h-4 px-1.5 text-[10px] font-medium rounded bg-current/5 leading-none italic ml-1.5 opacity-70"
      >
        Unbound
      </span>
    );
  }
  return (
    <span data-inline-key-badge className="inline-flex items-center gap-0.5 ml-1.5">
      {resolvedKeys.map((key) => (
        <span
          key={key}
          className="inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-medium rounded bg-current/10 leading-none shadow-[0_2px_0_0_rgba(0,0,0,0.3)]"
        >
          {key === "Mod" && isMac ? <IconCommand className="size-2.5" /> : formatKey(key)}
        </span>
      ))}
    </span>
  );
};

// -- Exports ------------------------------------------------------------------

export { InlineKeyBadge };
