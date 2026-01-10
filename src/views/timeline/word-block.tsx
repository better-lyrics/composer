import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/utils/cn";

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
  onClick: () => void;
  onResizeStart: (edge: "left" | "right", startX: number) => void;
}

// -- Component -----------------------------------------------------------------

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
  onClick,
  onResizeStart,
}) => {
  const left = begin * zoom;
  const naturalWidth = (end - begin) * zoom;
  const width = Math.max(naturalWidth, 4);
  const showText = naturalWidth >= 20;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { lineId, lineIndex, wordIndex, trackType, text, begin, end },
  });

  const handleLeftResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart("left", e.clientX);
  };

  const handleRightResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart("right", e.clientX);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute top-1 bottom-1 flex items-center justify-center",
        "text-xs text-white truncate select-none cursor-grab",
        "border rounded-xl transition-opacity duration-100",
        isDimmed && "opacity-30",
        isDragging && "opacity-50 cursor-grabbing z-50",
      )}
      style={{
        left,
        width,
        backgroundColor: `${color}30`,
        borderColor: `${color}50`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      {...attributes}
      {...listeners}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 z-10"
        onMouseDown={handleLeftResizeStart}
        onPointerDown={(e) => e.stopPropagation()}
      />

      {showText && <span className="px-1 pointer-events-none truncate">{text}</span>}

      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 z-10"
        onMouseDown={handleRightResizeStart}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { WordBlock };
