import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import { formatTime } from "@/utils/format-time";

// -- Types ---------------------------------------------------------------------

interface SnapMarkerPinProps {
  index: number;
  time: number;
  zoom: number;
  fadeExtent: number;
  isDragging: boolean;
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
  onHeadPointerDown,
  onDelete,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const showTooltip = isHovered && !isDragging;

  return (
    <div
      data-snap-marker="custom"
      data-snap-marker-time={time}
      className="absolute top-0"
      style={{ left: time * zoom }}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <div
        data-snap-marker-line
        className="snap-custom-line absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ height: fadeExtent }}
      />
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
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 flex items-center gap-2 whitespace-nowrap rounded-md border border-composer-border-hover bg-composer-bg-elevated px-2 py-1 shadow-lg pointer-events-auto"
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
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SnapMarkerPin };
export type { SnapMarkerPinProps };
