import { cn } from "@/utils/cn";

// -- Types ---------------------------------------------------------------------

interface WordBlockProps {
  text: string;
  begin: number;
  end: number;
  color: string;
  zoom: number;
  isSelected: boolean;
  isDimmed: boolean;
  onClick: () => void;
  onResizeStart: (edge: "left" | "right", startX: number) => void;
}

// -- Component -----------------------------------------------------------------

const WordBlock: React.FC<WordBlockProps> = ({
  text,
  begin,
  end,
  color,
  zoom,
  isSelected,
  isDimmed,
  onClick,
  onResizeStart,
}) => {
  const left = begin * zoom;
  const width = Math.max((end - begin) * zoom, 24);

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
      className={cn(
        "absolute top-0 h-full flex items-center justify-center",
        "text-xs text-white truncate select-none",
        "border-2 rounded-sm transition-opacity duration-100",
        isDimmed && "opacity-30",
        isSelected && "ring-1 ring-white/40"
      )}
      style={{
        left,
        width,
        backgroundColor: `${color}40`,
        borderColor: isSelected ? color : `${color}60`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-10"
        onMouseDown={handleLeftResizeStart}
      />

      {/* Word text */}
      <span className="px-1.5 pointer-events-none truncate">{text}</span>

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-10"
        onMouseDown={handleRightResizeStart}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { WordBlock };
