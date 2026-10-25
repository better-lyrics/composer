import { DragOverlay } from "@dnd-kit/core";
import type { LyricLine } from "@/domain/line/model";
import type { SyllablePosition } from "@/domain/word/syllable-groups";
import { cn } from "@/utils/cn";
import { type WordTrackType, bgTrackHeight, wordInsetPx } from "@/views/timeline/row-geometry";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types ---------------------------------------------------------------------

interface DragGhostCell {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  syllablePosition: SyllablePosition;
  lane: WordTrackType;
}

interface DragGhostProps {
  cells: DragGhostCell[];
  anchorWidth: number;
  anchorHeight: number;
  color: string;
  isSnapped: boolean;
}

// -- Constants -----------------------------------------------------------------

const GHOST_SYLLABLE_RADIUS: Record<SyllablePosition, string | undefined> = {
  none: undefined,
  first: "rounded-r-none",
  middle: "rounded-none",
  last: "rounded-l-none",
};

// -- Components ----------------------------------------------------------------

const DragGhost: React.FC<DragGhostProps> = ({ cells, anchorWidth, anchorHeight, color, isSnapped }) => (
  <div className="relative" style={{ width: anchorWidth, height: anchorHeight }}>
    {cells.map((cell) => (
      <div
        key={`${cell.left}-${cell.top}`}
        data-word-block
        data-syllable-position={cell.syllablePosition}
        data-lane={cell.lane}
        className={cn(
          "word-face absolute flex items-center justify-center whitespace-nowrap pointer-events-none",
          GHOST_SYLLABLE_RADIUS[cell.syllablePosition],
          isSnapped && "is-snapped",
        )}
        style={{
          left: cell.left,
          top: cell.top,
          width: cell.width,
          height: cell.height,
          "--agent": color,
        }}
      >
        <span className="min-w-0 overflow-hidden whitespace-nowrap [text-overflow:inherit]">{cell.text}</span>
      </div>
    ))}
  </div>
);

interface HoverSizedDragGhostProps extends DragGhostProps {
  lines: LyricLine[];
}

function useHoveredBlockHeight(lines: LyricLine[]): number | null {
  return useTimelineStore((s) => {
    const hover = s.wordDragHover;
    const line = hover ? lines[hover.lineIndex] : undefined;
    if (!hover || !line) return null;
    const mainHeight = s.rowHeights[line.id] ?? s.defaultRowHeight;
    const trackHeight = hover.track === "word" ? mainHeight : bgTrackHeight(line, mainHeight);
    return trackHeight - wordInsetPx(hover.track) * 2;
  });
}

const HoverSizedDragGhost: React.FC<HoverSizedDragGhostProps> = ({ lines, cells, anchorHeight, ...rest }) => {
  const height = useHoveredBlockHeight(lines);
  const onAnchorTrack = cells.every((cell) => cell.top === 0);
  if (!onAnchorTrack || height === null) {
    return <DragGhost cells={cells} anchorHeight={anchorHeight} {...rest} />;
  }
  return <DragGhost cells={cells.map((cell) => ({ ...cell, height }))} anchorHeight={height} {...rest} />;
};

// dnd-kit's overlay is a fixed box over the pointer; the drop target is hit-tested underneath it.
const TimelineDragOverlay: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <DragOverlay dropAnimation={null} className="pointer-events-none">
    {children}
  </DragOverlay>
);

// -- Exports -------------------------------------------------------------------

export type { DragGhostCell };
export { DragGhost, HoverSizedDragGhost, TimelineDragOverlay };
