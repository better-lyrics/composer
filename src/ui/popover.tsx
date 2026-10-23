import { unscaledReference, useFloatingEntrance } from "@/ui/floating-motion";
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import type { Placement } from "@floating-ui/react";
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
  instant?: boolean;
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
  instant = false,
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
    middleware: [
      offset(offsetPx),
      flip(),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply: ({ availableHeight, elements }) => {
          elements.floating.style.maxHeight = `${availableHeight}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const { isMounted, styles: entranceStyles } = useFloatingEntrance(context, instant);
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
              style={floatingStyles}
              {...getFloatingProps()}
              aria-label={ariaLabel}
              className="layer-floating w-max max-w-[calc(100vw-16px)] outline-none"
            >
              {/* The entrance scales this inner surface: a scale on the positioned layer would also scale its translate. */}
              <div
                style={entranceStyles}
                className="flex flex-col max-h-[inherit] select-none rounded-[14px] surface-floating"
              >
                {typeof children === "function" ? children(() => setIsOpen(false), getItemProps) : children}
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { Popover };
