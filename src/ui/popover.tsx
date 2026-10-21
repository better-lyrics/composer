import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import type { Placement } from "@floating-ui/react";
import { type MutableRefObject, type ReactElement, type ReactNode, cloneElement, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

type GetItemProps = ReturnType<typeof useInteractions>["getItemProps"];

interface PopoverListNavigation {
  listRef: MutableRefObject<Array<HTMLElement | null>>;
  activeIndex: number | null;
  selectedIndex: number | null;
  onNavigate: (index: number | null) => void;
}

interface PopoverProps {
  trigger: ReactElement;
  children: ReactNode | ((close: () => void, getItemProps: GetItemProps) => ReactNode);
  placement?: Placement;
  offsetPx?: number;
  hasPopup?: "dialog" | "listbox" | "menu";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  "aria-label"?: string;
  listNavigation?: PopoverListNavigation;
}

// -- Component ----------------------------------------------------------------

const Popover: React.FC<PopoverProps> = ({
  trigger,
  children,
  placement = "bottom",
  offsetPx = 8,
  hasPopup = "dialog",
  open,
  onOpenChange,
  "aria-label": ariaLabel,
  listNavigation,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setIsOpen = (next: boolean) => {
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    middleware: [offset(offsetPx), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  // Dismissing on click, after mousedown moved focus to the body, lets focus return to the trigger.
  const dismiss = useDismiss(context, { outsidePressEvent: "click" });
  const role = useRole(context);
  const unusedListRef = useRef<Array<HTMLElement | null>>([]);
  const navigation = useListNavigation(context, {
    listRef: listNavigation?.listRef ?? unusedListRef,
    activeIndex: listNavigation?.activeIndex ?? null,
    selectedIndex: listNavigation?.selectedIndex ?? null,
    onNavigate: listNavigation?.onNavigate,
    loop: true,
    enabled: listNavigation !== undefined,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([click, dismiss, role, navigation]);

  return (
    <>
      {cloneElement(trigger, {
        ref: refs.setReference,
        ...getReferenceProps(),
        "aria-haspopup": hasPopup,
      } as React.HTMLAttributes<HTMLElement> & { ref: typeof refs.setReference })}

      {isOpen && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              aria-label={ariaLabel}
              className="layer-floating border select-none shadow-2xl rounded-xl bg-composer-bg border-composer-border"
            >
              {typeof children === "function" ? children(() => setIsOpen(false), getItemProps) : children}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { Popover };
