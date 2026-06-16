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
import { m, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { pinDropInVariants, snapFlashVariants } from "@/utils/animationVariants";
import { formatTime } from "@/utils/format-time";

// -- Types ---------------------------------------------------------------------

interface SnapMarkerPinProps {
  index: number;
  time: number;
  zoom: number;
  fadeExtent: number;
  isDragging: boolean;
  isNew: boolean;
  isOnOnset: boolean;
  onHeadPointerDown: (index: number, event: React.PointerEvent<HTMLElement>) => void;
  onDelete: (index: number) => void;
  onHoverChange?: (hovering: boolean) => void;
}

// -- Component -----------------------------------------------------------------

const SnapMarkerPin: React.FC<SnapMarkerPinProps> = ({
  index,
  time,
  zoom,
  fadeExtent,
  isDragging,
  isNew,
  isOnOnset,
  onHeadPointerDown,
  onDelete,
  onHoverChange,
}) => {
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context, placement } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      setIsOpen(open);
      onHoverChange?.(open);
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

  const wasOnOnsetRef = useRef(false);
  const [flashKey, setFlashKey] = useState(0);
  if (isOnOnset && !wasOnOnsetRef.current) setFlashKey((key) => key + 1);
  wasOnOnsetRef.current = isOnOnset;

  // Pins are keyed by position, so an insert before an existing pin reuses this
  // element instead of remounting it. Bump a key when the pin becomes newly
  // placed so the drop-in wrapper remounts and the entry animation replays.
  const wasNewRef = useRef(false);
  const [dropInKey, setDropInKey] = useState(0);
  if (isNew && !wasNewRef.current) setDropInKey((key) => key + 1);
  wasNewRef.current = isNew;

  const showTooltip = isOpen && !isDragging;

  return (
    <m.div
      key={dropInKey}
      data-snap-marker="custom"
      data-snap-marker-time={time}
      data-snap-marker-drop-in
      data-snap-marker-new={isNew ? "" : undefined}
      className="absolute top-0"
      style={{ left: time * zoom }}
      variants={pinDropInVariants}
      initial={isNew && !reduceMotion ? "initial" : false}
      animate="animate"
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
          onPointerDown: (event: React.PointerEvent<HTMLElement>) => onHeadPointerDown(index, event),
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
              onClick={() => onDelete(index)}
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
};

// -- Exports -------------------------------------------------------------------

export { SnapMarkerPin };
export type { SnapMarkerPinProps };
