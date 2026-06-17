import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { IconTrash } from "@tabler/icons-react";
import { m, useIsPresent, useReducedMotion } from "motion/react";
import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { pinDropInVariants, snapFlashVariants } from "@/utils/animationVariants";
import { formatTime } from "@/utils/format-time";

// -- Types ---------------------------------------------------------------------

interface SnapMarkerPinProps {
  id: string;
  time: number;
  zoom: number;
  fadeExtent: number;
  isDragging: boolean;
  isOnOnset: boolean;
  onHeadPointerDown: (id: string, event: React.PointerEvent<HTMLElement>) => void;
  onDelete: (id: string) => void;
  onHoverChange?: (id: string, hovering: boolean) => void;
}

// -- Component -----------------------------------------------------------------

const SnapMarkerPin = memo(function SnapMarkerPin({
  id,
  time,
  zoom,
  fadeExtent,
  isDragging,
  isOnOnset,
  onHeadPointerDown,
  onDelete,
  onHoverChange,
}: SnapMarkerPinProps) {
  const reduceMotion = useReducedMotion();
  const isPresent = useIsPresent();
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context, placement } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      setIsOpen(open);
      onHoverChange?.(id, open);
    },
    placement: "bottom-start",
    // The delete control leads the row and sits directly under the rotated head. crossAxis
    // centers it; the sign mirrors when flip() re-aligns to the end (no room on the right),
    // and the row reverses so the delete control stays under the head. Values are visually tuned.
    middleware: [
      offset(({ placement: resolved }) => ({ mainAxis: 8, crossAxis: resolved.endsWith("-end") ? 6 : -6 })),
      flip({ fallbackPlacements: ["bottom-end", "top-start", "top-end"] }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const tooltipAlignEnd = placement.endsWith("-end");

  const hover = useHover(context, {
    enabled: !isDragging,
    handleClose: safePolygon(),
    delay: { open: 0, close: 60 },
  });
  const role = useRole(context, { role: "tooltip" });
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, role, dismiss]);

  // floating-ui does not fire onOpenChange when the reference unmounts, so a pin
  // removed while hovered (undo, project load, audio change) would leave the
  // overlay's hovered id pointing at a gone pin. Clear it through the same callback.
  useEffect(() => () => onHoverChange?.(id, false), [id, onHoverChange]);

  const wasOnOnsetRef = useRef(false);
  const [flashKey, setFlashKey] = useState(0);
  if (isOnOnset && !wasOnOnsetRef.current) setFlashKey((key) => key + 1);
  wasOnOnsetRef.current = isOnOnset;

  // Drop the tooltip the instant the pin starts exiting. Without this it keeps
  // tracking the head as the exit transform shrinks and lifts it, so the
  // floating tooltip drifts up and to the side before the pin unmounts.
  const showTooltip = isOpen && !isDragging && isPresent;

  return (
    <m.div
      data-snap-marker="custom"
      data-snap-marker-time={time}
      data-snap-marker-drop-in
      className="absolute top-0"
      style={{ left: time * zoom }}
      variants={pinDropInVariants}
      initial={reduceMotion ? false : "initial"}
      animate="animate"
      exit={reduceMotion ? undefined : "exit"}
    >
      <div
        data-snap-marker-line
        className="snap-custom-line absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ height: fadeExtent }}
      />
      {flashKey > 0 && (
        <m.div
          key={flashKey}
          data-snap-marker-flash
          data-flash-key={flashKey}
          className="snap-marker-flash absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ height: fadeExtent }}
          variants={snapFlashVariants}
          initial="initial"
          animate={reduceMotion ? "initial" : "animate"}
        />
      )}
      <button
        ref={refs.setReference}
        type="button"
        data-snap-marker-head
        aria-label={`Custom snap point at ${formatTime(time)}`}
        className={cn(
          "snap-custom-head expanded-hit-sm absolute top-0 left-1/2 pointer-events-auto select-none border-none p-0",
          isDragging ? "cursor-grabbing ring-4 ring-composer-warning/20" : "cursor-grab",
        )}
        {...getReferenceProps({
          onPointerDown: (event: React.PointerEvent<HTMLElement>) => onHeadPointerDown(id, event),
        })}
      />
      {showTooltip && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            data-snap-marker-tooltip
            data-snap-marker-tooltip-align={tooltipAlignEnd ? "end" : "start"}
            className={cn(
              "z-100 flex items-center gap-2 whitespace-nowrap rounded-md border border-composer-border-hover bg-composer-bg-elevated px-2 py-1 shadow-lg pointer-events-auto",
              tooltipAlignEnd && "flex-row-reverse",
            )}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            <button
              type="button"
              data-snap-marker-delete
              aria-label="Delete custom snap point"
              className="relative expanded-hit-sm flex items-center justify-center size-4 text-composer-text-faint hover:text-composer-warning select-none cursor-pointer"
              onClick={() => onDelete(id)}
            >
              <IconTrash size={13} />
            </button>
            <span
              data-snap-marker-time-label
              className="font-mono text-[10.5px] leading-none text-composer-text select-text cursor-text"
            >
              {formatTime(time)}
            </span>
          </div>
        </FloatingPortal>
      )}
    </m.div>
  );
});

// -- Exports -------------------------------------------------------------------

export { SnapMarkerPin };
export type { SnapMarkerPinProps };
