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
import { unscaledReference, useFloatingEntrance } from "@/ui/floating-motion";
import {
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  cloneElement,
  useCallback,
  useRef,
  useState,
} from "react";

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
  // Positions against this element instead of the trigger, such as the whole control group the trigger sits in.
  positionAnchor?: HTMLElement | null;
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
  positionAnchor,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setIsOpen = (next: boolean) => {
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    // The entrance scales the layer, and a scale also scales a translate, so position with top and left.
    transform: false,
    onOpenChange: setIsOpen,
    placement,
    middleware: [offset(offsetPx), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { isMounted, styles: entranceStyles } = useFloatingEntrance(context);
  const { setReference, setPositionReference } = refs;
  const setTrigger = useCallback(
    (element: HTMLElement | null) => {
      setReference(element);
      const anchor = positionAnchor ?? element;
      setPositionReference(anchor ? unscaledReference(anchor) : null);
    },
    [setReference, setPositionReference, positionAnchor],
  );

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
        ref: setTrigger,
        ...getReferenceProps(trigger.props as React.HTMLProps<Element>),
        "aria-haspopup": hasPopup,
      } as React.HTMLAttributes<HTMLElement> & { ref: typeof setTrigger })}

      {isMounted && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={{ ...floatingStyles, ...entranceStyles }}
              {...getFloatingProps()}
              aria-label={ariaLabel}
              className="layer-floating w-max select-none rounded-[14px] surface-floating"
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
