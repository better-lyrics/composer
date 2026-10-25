import { IconButton } from "@/ui/icon-button";
import { Popover } from "@/ui/popover";
import { IconChevronDown } from "@tabler/icons-react";
import { type ReactElement, type ReactNode, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface SplitLatchProps {
  latch: ReactElement;
  menuLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

// -- Component -----------------------------------------------------------------

// One pill: the latch toggles, the inset caret opens its options against the whole tray.
const SplitLatch: React.FC<SplitLatchProps> = ({ latch, menuLabel, open, onOpenChange, children }) => {
  const [pill, setPill] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setPill} className="split-latch">
      {latch}
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        placement="bottom-start"
        aria-label={menuLabel}
        positionAnchor={pill?.parentElement}
        trigger={
          <IconButton
            variant="ghost"
            label={menuLabel}
            icon={<IconChevronDown aria-hidden="true" className="size-[13px]" />}
          />
        }
      >
        {children}
      </Popover>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SplitLatch };
