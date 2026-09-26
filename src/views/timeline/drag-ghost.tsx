import { DragOverlay } from "@dnd-kit/core";
import type { LyricLine } from "@/domain/line/model";
import type { SyllablePosition } from "@/domain/word/syllable-groups";
import { cn } from "@/utils/cn";
import { BLOCK_INSET_PX, bgTrackHeight } from "@/views/timeline/row-geometry";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types ---------------------------------------------------------------------

interface DragGhostCell {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  syllablePosition: SyllablePosition;
}

interface DragGhostProps {
  cells: DragGhostCell[];
  anchorWidth: number;
  anchorHeight: number;
  color: string;
  isSnapped: boolean;
}

// -- Constants -----------------------------------------------------------------

const GHOST_SYLLABLE_RADIUS: Record<SyllablePosition, string> = {
  none: "rounded-xl",
  first: "rounded-l-xl rounded-r-none",
  middle: "rounded-none",
  last: "rounded-r-xl rounded-l-none",
};

// -- Components ----------------------------------------------------------------

const DragGhost: React.FC<DragGhostProps> = ({ cells, anchorWidth, anchorHeight, color, isSnapped }) => (
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

interface HoverSizedDragGhostProps extends DragGhostProps {
  lines: LyricLine[];
}

function useHoveredTrackHeight(lines: LyricLine[]): number | null {
  return useTimelineStore((s) => {
    const hover = s.wordDragHover;
    const line = hover ? lines[hover.lineIndex] : undefined;
    if (!hover || !line) return null;
    const mainHeight = s.rowHeights[line.id] ?? s.defaultRowHeight;
    return hover.track === "word" ? mainHeight : bgTrackHeight(line, mainHeight);
  });
}

const HoverSizedDragGhost: React.FC<HoverSizedDragGhostProps> = ({ lines, cells, anchorHeight, ...rest }) => {
  const hoveredTrackHeight = useHoveredTrackHeight(lines);
  if (cells.length !== 1 || hoveredTrackHeight === null) {
    return <DragGhost cells={cells} anchorHeight={anchorHeight} {...rest} />;
  }
  const height = hoveredTrackHeight - BLOCK_INSET_PX * 2;
  return <DragGhost cells={[{ ...cells[0], height }]} anchorHeight={height} {...rest} />;
};

// dnd-kit's overlay is a fixed box over the pointer; the drop target is hit-tested underneath it.
const TimelineDragOverlay: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <DragOverlay dropAnimation={null} className="pointer-events-none">
    {children}
  </DragOverlay>
);

// -- Exports -------------------------------------------------------------------

export { DragGhost, HoverSizedDragGhost, TimelineDragOverlay };
export type { DragGhostCell };
