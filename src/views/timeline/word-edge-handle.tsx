import type { SyllablePosition } from "@/domain/word/syllable-groups";
import { cn } from "@/utils/cn";

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
  left: "left-0 rounded-tl-[inherit] rounded-bl-[inherit]",
  right: "right-0 rounded-tr-[inherit] rounded-br-[inherit]",
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
  const joinsNeighbour = (syllableEdgesJoin && SYLLABLE_JOINS_AT[edge].has(syllablePosition)) || conjoined;

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

export { WordEdgeHandle };
