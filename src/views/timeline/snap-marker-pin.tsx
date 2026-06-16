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
}) => {
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

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

  const showTooltip = isOpen && !isDragging;

  return (
    <m.div
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
            className="z-100 flex items-center gap-2 whitespace-nowrap rounded-md border border-composer-border-hover bg-composer-bg-elevated px-2 py-1 shadow-lg pointer-events-auto"
            style={floatingStyles}
            {...getFloatingProps()}
          >
            <span
              data-snap-marker-time-label
              className="font-mono text-[10.5px] leading-none text-composer-text select-text cursor-text"
            >
              {formatTime(time)}
            </span>
            <button
              type="button"
              data-snap-marker-delete
              aria-label="Delete custom snap point"
              className="flex items-center justify-center size-4 text-composer-text-faint hover:text-composer-warning select-none cursor-pointer"
              onClick={() => onDelete(index)}
            >
              <IconTrash size={13} />
            </button>
          </div>
        </FloatingPortal>
      )}
    </m.div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SnapMarkerPin };
export type { SnapMarkerPinProps };
