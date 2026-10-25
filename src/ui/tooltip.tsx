import { useFloatingEntrance } from "@/ui/floating-motion";
import {
  FloatingArrow,
  FloatingDelayGroup,
  FloatingPortal,
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useDelayGroup,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import type { Placement } from "@floating-ui/react";
import { cloneElement, useEffect, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  placement?: Placement;
  delay?: number;
  disabled?: boolean;
}

// -- Constants ----------------------------------------------------------------

const SHOW_DELAY = 300;
const WARM_GROUP_MS = 400;
const ARROW_SIZE = 4;
const ARROW_TIP_RADIUS = 2;
// Composed with the per-side rotation, so the base overlaps the body edge ring by 1px on every side.
const ARROW_OVERLAP_STYLE = { transform: "translateY(-1px)" };

// -- Component ----------------------------------------------------------------

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = "top",
  delay = SHOW_DELAY,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [opensWarm, setOpensWarm] = useState(false);
  const arrowRef = useRef(null);
  const isOpenRef = useRef(false);
  if (disabled && isOpen) setIsOpen(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      const opens = open && !disabled;
      if (opens) setOpensWarm(group.isInstantPhase || group.currentId != null);
      isOpenRef.current = opens;
      setIsOpen(opens);
    },
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 }), arrow({ element: arrowRef })],
    whileElementsMounted: autoUpdate,
  });

  const group = useDelayGroup(context);
  const { setCurrentId } = group;
  // useDelayGroup only releases the group on close, so a trigger removed while open would leave it warm.
  useEffect(
    () => () => {
      if (isOpenRef.current) setCurrentId(null);
    },
    [setCurrentId],
  );
  const { styles: entranceStyles } = useFloatingEntrance(context, opensWarm);
  const hover = useHover(context, { move: false, delay: { open: group.currentId == null ? delay : 0, close: 0 } });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);
  // The span is the hover target so disabled triggers still show the tip; the description goes on the child that takes focus.
  const { "aria-describedby": describedBy, ...referenceProps } = getReferenceProps();

  return (
    <>
      <span ref={refs.setReference} className="inline-flex" {...referenceProps}>
        {typeof describedBy === "string" ? cloneElement(children, { "aria-describedby": describedBy }) : children}
      </span>
      {isOpen && (
        <FloatingPortal>
          <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()} className="layer-floating">
            <div
              style={entranceStyles}
              className="w-max max-w-48 select-none px-2 py-1.5 text-xs text-center leading-snug rounded-lg text-composer-text surface-floating"
            >
              {content}
              <FloatingArrow
                ref={arrowRef}
                context={context}
                width={ARROW_SIZE * 2}
                height={ARROW_SIZE}
                tipRadius={ARROW_TIP_RADIUS}
                strokeWidth={1}
                fill="currentColor"
                className="text-(--pop) stroke-(--edge)"
                style={ARROW_OVERLAP_STYLE}
              />
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
};

const TooltipGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <FloatingDelayGroup delay={SHOW_DELAY} timeoutMs={WARM_GROUP_MS}>
    {children}
  </FloatingDelayGroup>
);

// -- Exports ------------------------------------------------------------------

export { Tooltip, TooltipGroup };
