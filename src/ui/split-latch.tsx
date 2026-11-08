import type { Placement } from "@floating-ui/react";
import { IconChevronDown } from "@tabler/icons-react";
import { type ReactElement, type ReactNode, useState } from "react";
import { IconButton } from "@/ui/icon-button";
import { Popover } from "@/ui/popover";
import { Tooltip } from "@/ui/tooltip";
import { cn } from "@/utils/cn";

// -- Types ---------------------------------------------------------------------

type SplitLatchVariant = "toggle" | "action" | "raised";

interface SplitLatchProps {
  latch: ReactElement;
  menuLabel: string;
  menuTip?: ReactNode;
  variant?: SplitLatchVariant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: Placement;
  className?: string;
  children: ReactNode;
}

// -- Constants -----------------------------------------------------------------

const PILL_CLASS: Record<SplitLatchVariant, string> = {
  toggle: "split-latch",
  action: "split-action",
  raised: "split-raised",
};

// -- Component -----------------------------------------------------------------

// One pill: the latch toggles or acts, the inset caret opens its options. A toggle sits in a tray and anchors to it.
// Action pills sit flat in a header; raised pills take the secondary button face.
const SplitLatch: React.FC<SplitLatchProps> = ({
  latch,
  menuLabel,
  menuTip,
  variant = "toggle",
  open,
  onOpenChange,
  placement = "bottom-start",
  className,
  children,
}) => {
  const [pill, setPill] = useState<HTMLDivElement | null>(null);
  const menu = (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      placement={placement}
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
    <div ref={setPill} className={cn(PILL_CLASS[variant], className)}>
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
