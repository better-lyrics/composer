import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ShortcutTip } from "@/ui/shortcut-tip";
import { Tooltip } from "@/ui/tooltip";

// -- Interfaces ----------------------------------------------------------------

interface HeaderActionProps {
  onClick: () => void;
  label: string;
  shortcut: string;
  showHint: boolean;
  description?: string;
  children: React.ReactNode;
}

// -- Components ----------------------------------------------------------------

const HeaderAction: React.FC<HeaderActionProps> = ({ onClick, label, shortcut, showHint, description, children }) => (
  <Tooltip content={<ShortcutTip label={label} shortcut={shortcut} description={description} />} placement="bottom">
    <Button
      variant="ghost"
      size="lg"
      hasIcon
      onClick={onClick}
      aria-label={label}
      className="shrink-0 min-w-9 gap-1 px-2 [&>svg]:size-4 [&>[data-inline-key-badge]]:ml-0"
    >
      {children}
      {showHint && <InlineKeyBadge keys={getEffectiveKeysArray(shortcut)} />}
    </Button>
  </Tooltip>
);

// -- Exports -------------------------------------------------------------------

export { HeaderAction };
