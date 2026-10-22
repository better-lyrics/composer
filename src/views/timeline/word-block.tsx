import { cn } from "@/utils/cn";
import type { SyllablePosition } from "@/domain/word/syllable-groups";
import { wordBlockWidth } from "@/views/timeline/row-geometry";
import { selfKey } from "@/views/timeline/snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordEdgeHandle } from "@/views/timeline/word-edge-handle";
import { wordFit } from "@/views/timeline/word-fit";
import { useDraggable } from "@dnd-kit/core";
import { useMemo } from "react";

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
  gapBefore?: boolean;
  gapAfter?: boolean;
  syllableEdgesJoin?: boolean;
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

// A syllable squares the corners it shares with its neighbours; a timing gap keeps the facing corners round.
function syllableRadius(position: SyllablePosition, gapBefore?: boolean, gapAfter?: boolean): string | undefined {
  const squareLeft = (position === "middle" || position === "last") && !gapBefore;
  const squareRight = (position === "first" || position === "middle") && !gapAfter;
  return cn(squareLeft && "rounded-l-none", squareRight && "rounded-r-none") || undefined;
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
  gapAfter,
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
  const width = wordBlockWidth(begin, end, zoom);
  const { fit, cut } = useMemo(() => wordFit(text, width, trackType), [text, width, trackType]);

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

  return (
    <div
      ref={setNodeRef}
      id={id}
      data-word-block
      data-syllable-position={syllablePosition}
      data-lane={trackType}
      data-fit={fit}
      data-cut={cut || undefined}
      data-begin={begin}
      data-end={end}
      data-selected={isSelected || undefined}
      className={cn(
        "word-face absolute flex items-center justify-center whitespace-nowrap select-none cursor-grab",
        trackType === "bg" ? "inset-y-[3px]" : "inset-y-[5px]",
        syllableRadius(syllablePosition, gapBefore, gapAfter),
        isDimmed && "opacity-30",
        isDragging && "opacity-50 cursor-grabbing z-50",
        isExplicit && "is-explicit-word",
        isSnapped && !isDragging && "is-snapped",
      )}
      style={{ left, width, "--agent": color }}
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
        conjoined={leftConjoined}
        highlighted={leftHighlighted}
        showGrip={showLeftGrip}
        onResizeStart={onResizeStart}
        onEdgeHover={onEdgeHover}
      />

      {fit !== "tick" && (
        <span className="min-w-0 overflow-hidden whitespace-nowrap pointer-events-none">
          {text}
        </span>
      )}

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
