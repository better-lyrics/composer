import { cn } from "@/utils/cn";
import type { SyllablePosition } from "@/domain/word/syllable-groups";
import { selfKey } from "@/views/timeline/snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordEdgeHandle } from "@/views/timeline/word-edge-handle";
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
  isExplicit?: boolean;
  syllablePosition?: SyllablePosition;
  syllableEdgesJoin?: boolean;
  gapBefore?: boolean;
  leftHighlighted?: boolean;
  rightHighlighted?: boolean;
  leftConjoined?: boolean;
  rightConjoined?: boolean;
  showLeftGrip?: boolean;
  showRightGrip?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onResizeStart: (edge: "left" | "right", startX: number) => void;
  onEdgeHover?: (edge: "left" | "right", hovering: boolean) => void;
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

function syllableBorderStyle(
  position: SyllablePosition,
  isSelected: boolean,
  gapBefore: boolean | undefined,
): React.CSSProperties {
  if (isSelected) return {};
  const style: React.CSSProperties = {};
  if (position === "first" || position === "middle") style.borderRightStyle = "dashed";
  if (position === "middle" || position === "last") {
    if (gapBefore) style.borderLeftStyle = "dashed";
    else style.borderLeftWidth = 0;
  }
  return style;
}

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
  isExplicit,
  syllablePosition = "none",
  syllableEdgesJoin = true,
  gapBefore,
  leftHighlighted,
  rightHighlighted,
  leftConjoined,
  rightConjoined,
  showLeftGrip,
  showRightGrip,
  onClick,
  onResizeStart,
  onEdgeHover,
  onDoubleClick,
  onContextMenu,
}) => {
  const left = begin * zoom;
  const naturalWidth = (end - begin) * zoom;
  const width = Math.max(naturalWidth, 4);
  const showText = naturalWidth >= 20;

  const myKey = selfKey(lineId, wordIndex, trackType);
  const isSnapped = useTimelineStore((s) => s.snappedBlockId === myKey);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: {
      lineId,
      lineIndex,
      wordIndex,
      trackType,
      text,
      begin,
      end,
      snap: { edgesAtStart: [begin, end] },
    },
  });

  const syllableBorder = syllableBorderStyle(syllablePosition, isSelected, gapBefore);

  return (
    <div
      ref={setNodeRef}
      id={id}
      data-word-block
      data-syllable-position={syllablePosition}
      className={cn(
        "absolute top-1 bottom-1 flex items-center justify-center",
        "text-xs text-composer-text whitespace-nowrap select-none cursor-grab",
        "border transition-opacity duration-100",
        SYLLABLE_RADIUS[syllablePosition],
        isDimmed && "opacity-30",
        isDragging && "opacity-50 cursor-grabbing z-50",
        isExplicit && "is-explicit-word",
        isSnapped && !isDragging && "is-snapped",
      )}
      style={{
        left,
        width,
        backgroundColor: isSelected ? `${color}60` : `${color}40`,
        borderColor: isSelected ? `${color}B0` : `${color}70`,
        ...syllableBorder,
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
      role="button"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(e as unknown as React.MouseEvent);
      }}
    >
      <WordEdgeHandle
        edge="left"
        syllablePosition={syllablePosition}
        syllableEdgesJoin={syllableEdgesJoin}
        borderless={syllableBorder.borderLeftWidth === 0}
        conjoined={leftConjoined}
        highlighted={leftHighlighted}
        showGrip={showLeftGrip}
        onResizeStart={onResizeStart}
        onEdgeHover={onEdgeHover}
      />

      {showText && <span className="px-1 pointer-events-none truncate">{text}</span>}

      <WordEdgeHandle
        edge="right"
        syllablePosition={syllablePosition}
        syllableEdgesJoin={syllableEdgesJoin}
        conjoined={rightConjoined}
        highlighted={rightHighlighted}
        showGrip={showRightGrip}
        onResizeStart={onResizeStart}
        onEdgeHover={onEdgeHover}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { WordBlock };
