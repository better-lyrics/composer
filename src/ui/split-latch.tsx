import { IconButton } from "@/ui/icon-button";
import { Popover } from "@/ui/popover";
import { Tooltip } from "@/ui/tooltip";
import { IconChevronDown } from "@tabler/icons-react";
import { type ReactElement, type ReactNode, useState } from "react";

// -- Types ---------------------------------------------------------------------

type SplitLatchVariant = "toggle" | "action";

interface SplitLatchProps {
  latch: ReactElement;
  menuLabel: string;
  menuTip?: ReactNode;
  variant?: SplitLatchVariant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

// -- Constants -----------------------------------------------------------------

const PILL_CLASS: Record<SplitLatchVariant, string> = {
  toggle: "split-latch",
  action: "split-action",
};

// -- Component -----------------------------------------------------------------

// One pill: the latch toggles or acts, the inset caret opens its options. A toggle sits in a tray and anchors to it.
const SplitLatch: React.FC<SplitLatchProps> = ({
  latch,
  menuLabel,
  menuTip,
  variant = "toggle",
  open,
  onOpenChange,
  children,
}) => {
  const [pill, setPill] = useState<HTMLDivElement | null>(null);
  const menu = (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      placement="bottom-start"
      aria-label={menuLabel}
      positionAnchor={variant === "toggle" ? pill?.parentElement : pill}
      trigger={
        <IconButton
          variant="ghost"
          label={menuLabel}
          title={menuTip ? undefined : menuLabel}
          icon={<IconChevronDown aria-hidden="true" className="size-[13px]" />}
        />
      }
    >
      {children}
    </Popover>
  );
  return (
    <div ref={setPill} className={PILL_CLASS[variant]}>
      {latch}
      {menuTip ? (
        <Tooltip content={menuTip} placement="bottom" disabled={open}>
          {menu}
        </Tooltip>
      ) : (
        menu
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SplitLatch };
