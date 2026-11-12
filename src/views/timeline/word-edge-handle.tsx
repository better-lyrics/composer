import type { SyllablePosition } from "@/domain/word/syllable-groups";
import { cn } from "@/utils/cn";
import { memo } from "react";

// -- Types ---------------------------------------------------------------------

type WordEdge = "left" | "right";

interface WordEdgeHandleProps {
  edge: WordEdge;
  syllablePosition: SyllablePosition;
  syllableEdgesJoin: boolean;
  conjoined?: boolean;
  highlighted?: boolean;
  showGrip?: boolean;
  onResizeStart: (edge: WordEdge, startX: number) => void;
  onEdgeHover?: (edge: WordEdge, hovering: boolean) => void;
}

// -- Constants -----------------------------------------------------------------

const EDGE_CLASSES: Record<WordEdge, string> = {
  left: "left-0",
  right: "right-0",
};

// Matches the word's corner without `inherit`: an inherited radius makes every word restyle its edges on each zoom step.
const OPEN_CORNER_CLASSES: Record<WordEdge, string> = {
  left: "rounded-l-(--word-radius)",
  right: "rounded-r-(--word-radius)",
};

const SYLLABLE_JOINS_AT: Record<WordEdge, ReadonlySet<SyllablePosition>> = {
  left: new Set(["middle", "last"]),
  right: new Set(["first", "middle"]),
};

// -- Component -----------------------------------------------------------------

const WordEdgeHandle: React.FC<WordEdgeHandleProps> = ({
  edge,
  syllablePosition,
  syllableEdgesJoin,
  conjoined,
  highlighted,
  showGrip,
  onResizeStart,
  onEdgeHover,
}) => {
  const squareCorner = SYLLABLE_JOINS_AT[edge].has(syllablePosition);
  const joinsNeighbour = (syllableEdgesJoin && squareCorner) || conjoined;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onResizeStart(edge, e.clientX);
  };

  return (
    <div
      data-edge={edge}
      role="separator"
      aria-orientation="vertical"
      aria-hidden="true"
      className={cn(
        "absolute top-0 bottom-0 w-2 max-w-1/2 z-10",
        EDGE_CLASSES[edge],
        !squareCorner && OPEN_CORNER_CLASSES[edge],
        showGrip
          ? "cursor-ew-resize bg-composer-text/10 hover:bg-composer-text/20"
          : [
              "hover:bg-composer-text/10",
              joinsNeighbour ? "cursor-col-resize" : "cursor-ew-resize",
              highlighted && "bg-composer-text/10",
            ],
      )}
      data-grip={showGrip || undefined}
      onMouseDown={handleMouseDown}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => onEdgeHover?.(edge, true)}
      onMouseLeave={() => onEdgeHover?.(edge, false)}
    />
  );
};

// -- Exports -------------------------------------------------------------------

const MemoizedWordEdgeHandle = memo(WordEdgeHandle);
export { MemoizedWordEdgeHandle as WordEdgeHandle };
export type { WordEdge };
