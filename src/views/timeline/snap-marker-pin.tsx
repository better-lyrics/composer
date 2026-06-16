import { IconX } from "@tabler/icons-react";
import { m, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
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
  const [isHovered, setIsHovered] = useState(false);
  const showTooltip = isHovered && !isDragging;

  const wasOnOnsetRef = useRef(false);
  const [flashKey, setFlashKey] = useState(0);
  if (isOnOnset && !wasOnOnsetRef.current) setFlashKey((key) => key + 1);
  wasOnOnsetRef.current = isOnOnset;

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
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
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
      <div
        data-snap-marker-hit
        className="absolute top-0 left-1/2 -translate-x-1/2 w-3 pointer-events-auto"
        style={{ height: fadeExtent }}
      />
      <button
        type="button"
        data-snap-marker-head
        aria-label={`Custom snap point at ${formatTime(time)}`}
        className={`snap-custom-head absolute -top-2 left-1/2 pointer-events-auto select-none border-none p-0 ${
          isDragging ? "cursor-grabbing ring-4 ring-composer-warning/20" : "cursor-grab"
        }`}
        onPointerDown={(event) => onHeadPointerDown(index, event)}
      />
      {showTooltip && (
        <div
          data-snap-marker-tooltip
          className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap rounded-md border border-composer-border-hover bg-composer-bg-elevated px-2 py-1 shadow-lg pointer-events-auto"
        >
          <span
            data-snap-marker-time-label
            className="font-mono text-[10.5px] text-composer-text select-text cursor-text"
          >
            {formatTime(time)}
          </span>
          <button
            type="button"
            data-snap-marker-delete
            aria-label="Delete custom snap point"
            className="flex items-center text-composer-text-faint hover:text-composer-warning select-none cursor-pointer"
            onClick={() => onDelete(index)}
          >
            <IconX size={12} />
          </button>
        </div>
      )}
    </m.div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SnapMarkerPin };
export type { SnapMarkerPinProps };
