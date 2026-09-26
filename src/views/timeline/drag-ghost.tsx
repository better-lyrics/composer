import { DragOverlay } from "@dnd-kit/core";
import type { SyllablePosition } from "@/domain/word/syllable-groups";
import { cn } from "@/utils/cn";

// -- Types ---------------------------------------------------------------------

interface DragGhostCell {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  syllablePosition: SyllablePosition;
}

// -- Constants -----------------------------------------------------------------

const GHOST_SYLLABLE_RADIUS: Record<SyllablePosition, string> = {
  none: "rounded-xl",
  first: "rounded-l-xl rounded-r-none",
  middle: "rounded-none",
  last: "rounded-r-xl rounded-l-none",
};

// -- Components ----------------------------------------------------------------

const DragGhost: React.FC<{
  cells: DragGhostCell[];
  anchorWidth: number;
  anchorHeight: number;
  color: string;
  isSnapped: boolean;
}> = ({ cells, anchorWidth, anchorHeight, color, isSnapped }) => (
  <div className="relative" style={{ width: anchorWidth, height: anchorHeight }}>
    {cells.map((cell) => (
      <div
        key={`${cell.left}-${cell.top}`}
        data-word-block
        data-syllable-position={cell.syllablePosition}
        className={cn(
          "absolute flex items-center justify-center text-xs text-composer-text truncate border pointer-events-none",
          GHOST_SYLLABLE_RADIUS[cell.syllablePosition],
          isSnapped && "is-snapped",
        )}
        style={{
          left: cell.left,
          top: cell.top,
          width: cell.width,
          height: cell.height,
          backgroundColor: `${color}50`,
          borderColor: `${color}90`,
          ...(cell.syllablePosition === "first" || cell.syllablePosition === "middle"
            ? { borderRightStyle: "dashed" }
            : {}),
          ...(cell.syllablePosition === "middle" || cell.syllablePosition === "last" ? { borderLeftWidth: 0 } : {}),
        }}
      >
        <span className="px-1 truncate">{cell.text}</span>
      </div>
    ))}
  </div>
);

// dnd-kit's overlay is a fixed box over the pointer; the drop target is hit-tested underneath it.
const TimelineDragOverlay: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <DragOverlay dropAnimation={null} className="pointer-events-none">
    {children}
  </DragOverlay>
);

// -- Exports -------------------------------------------------------------------

export { DragGhost, TimelineDragOverlay };
export type { DragGhostCell };
