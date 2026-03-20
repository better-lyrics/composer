import { cn } from "@/utils/cn";
import type { SyllablePosition } from "@/utils/syllable-groups";
import { useDraggable } from "@dnd-kit/core";

// -- Types ---------------------------------------------------------------------

interface WordBlockProps {
  id: string;
  lineId: string;
  lineIndex: number;
  wordIndex: number;
  trackType: "word" | "bg";
  text: string;
  begin: number;
  end: number;
  color: string;
  zoom: number;
  isDimmed: boolean;
  isSelected: boolean;
  syllablePosition?: SyllablePosition;
  onClick: (e: React.MouseEvent) => void;
  onResizeStart: (edge: "left" | "right", startX: number) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

// -- Component -----------------------------------------------------------------

const SYLLABLE_RADIUS: Record<SyllablePosition, string> = {
  none: "rounded-xl",
  first: "rounded-l-xl rounded-r-none",
  middle: "rounded-none",
  last: "rounded-r-xl rounded-l-none",
};

const WordBlock: React.FC<WordBlockProps> = ({
  id,
  lineId,
  lineIndex,
  wordIndex,
  trackType,
  text,
  begin,
  end,
  color,
  zoom,
  isDimmed,
  isSelected,
  syllablePosition = "none",
  onClick,
  onResizeStart,
  onDoubleClick,
  onContextMenu,
}) => {
  const left = begin * zoom;
  const naturalWidth = (end - begin) * zoom;
  const width = Math.max(naturalWidth, 4);
  const showText = naturalWidth >= 20;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { lineId, lineIndex, wordIndex, trackType, text, begin, end },
  });

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const edge = e.currentTarget.dataset.edge as "left" | "right";
    onResizeStart(edge, e.clientX);
  };

  return (
    <div
      ref={setNodeRef}
      id={id}
      data-word-block
      className={cn(
        "absolute top-1 bottom-1 flex items-center justify-center",
        "text-xs text-white truncate select-none cursor-grab",
        "border transition-opacity duration-100",
        SYLLABLE_RADIUS[syllablePosition],
        isDimmed && "opacity-30",
        isSelected && "ring-2 ring-white/60",
        isDragging && "opacity-50 cursor-grabbing z-50",
      )}
      style={{
        left,
        width,
        backgroundColor: isSelected ? `${color}50` : `${color}30`,
        borderColor: isSelected ? `${color}90` : `${color}50`,
        ...(syllablePosition === "first" || syllablePosition === "middle" ? { borderRightStyle: "dashed" } : {}),
        ...(syllablePosition === "middle" || syllablePosition === "last" ? { borderLeftStyle: "dashed" } : {}),
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
      {...attributes}
      {...listeners}
    >
      <div
        data-edge="left"
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 z-10"
        onMouseDown={handleResizeStart}
        onPointerDown={(e) => e.stopPropagation()}
      />

      {showText && <span className="px-1 pointer-events-none truncate">{text}</span>}

      <div
        data-edge="right"
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 z-10"
        onMouseDown={handleResizeStart}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { WordBlock };
