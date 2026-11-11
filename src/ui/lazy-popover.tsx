import { type ReactElement, type ReactNode, cloneElement, useId, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LazyPopoverAnchor {
  reference: HTMLElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
}

type LazyPopoverTrigger = ReactElement<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> }
>;

interface LazyPopoverProps {
  hasPopup: "dialog" | "listbox";
  /** Always mounted; the popover anchors to it once open. */
  trigger: LazyPopoverTrigger;
  /** Renders a `Popover` in reference mode with the anchor. Mounts on the first open and stays mounted. */
  children: (anchor: LazyPopoverAnchor) => ReactNode;
}

// -- Constants ----------------------------------------------------------------

const LIST_OPENING_KEYS = new Set(["ArrowDown", "ArrowUp"]);

// -- Components ---------------------------------------------------------------

const LazyPopover: React.FC<LazyPopoverProps> = ({ hasPopup, trigger, children }) => {
  const id = useId();
  const [reference, setReference] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);

  const changeOpen = (next: boolean) => {
    if (next) setOpened(true);
    setOpen(next);
  };

  return (
    <>
      {cloneElement(trigger, {
        ref: setReference,
        "aria-haspopup": hasPopup,
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          trigger.props.onClick?.(event);
          changeOpen(!open);
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
          trigger.props.onKeyDown?.(event);
          if (open || hasPopup !== "listbox" || !LIST_OPENING_KEYS.has(event.key)) return;
          event.preventDefault();
          changeOpen(true);
        },
      })}
      {opened && children({ reference, open, onOpenChange: changeOpen, id })}
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { LazyPopover };
