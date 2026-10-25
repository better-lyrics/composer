import { getAgentColor } from "@/domain/agent/colors";
import { belongsToInstance } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { cn } from "@/utils/cn";
import { GutterAgentPicker } from "@/views/timeline/gutter-agent-picker";
import { EmptyBgTrack, EmptyWordTrack } from "@/views/timeline/line-row-empty-tracks";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useRowResize } from "@/views/timeline/use-row-resize";
import { WordTrack } from "@/views/timeline/word-track";
import { memo } from "react";

// -- Types ---------------------------------------------------------------------

interface LineRowProps {
  line: LyricLine;
  lineIndex: number;
  duration: number;
  onUpdateWord: (
    wordIndex: number,
    updates: Partial<WordTiming>,
    adjacentIndex?: number,
    adjacentUpdates?: Partial<WordTiming>,
  ) => void;
  onUpdateBgWord: (
    wordIndex: number,
    updates: Partial<WordTiming>,
    adjacentIndex?: number,
    adjacentUpdates?: Partial<WordTiming>,
  ) => void;
}

// -- Helpers -------------------------------------------------------------------

type DraggedGroupShift = ReturnType<typeof useTimelineStore.getState>["draggedGroupShift"];

function dragShiftPxFor(line: LyricLine, shift: DraggedGroupShift): number {
  return shift && belongsToInstance(line, shift.groupId, shift.instanceIdx) ? shift.offsetPx : 0;
}

// -- Component -----------------------------------------------------------------

const LineRow: React.FC<LineRowProps> = ({ line, lineIndex, duration, onUpdateWord, onUpdateBgWord }) => {
  const color = getAgentColor(line.agentId);
  const groupColor = useProjectStore((s) => s.groups.find((g) => g.id === line.groupId)?.color);
  const rowHeight = useTimelineStore((s) => s.rowHeights[line.id] ?? s.defaultRowHeight);
  const dragShiftPx = useTimelineStore((s) => dragShiftPxFor(line, s.draggedGroupShift));
  const shiftTransform = dragShiftPx !== 0 ? `translateX(${dragShiftPx}px)` : undefined;
  const { isResizing, startResize, resetHeight } = useRowResize(line.id, rowHeight);

  const hoveredTrack = useTimelineStore((s) =>
    s.wordDragHover?.lineIndex === lineIndex ? s.wordDragHover.track : null,
  );

  const mainWords = line.words?.length ? line.words : null;
  const bgWords = line.backgroundWords?.length ? line.backgroundWords : null;

  return (
    <div
      data-timeline-row
      data-row-line={lineIndex}
      data-in-group={groupColor ? "" : undefined}
      className="group/row relative flex"
      style={{ "--agent": color, "--group": groupColor }}
    >
      <div className="line-cell shrink-0 w-12 sticky left-0 z-60">
        <GutterAgentPicker lineId={line.id} lineIndex={lineIndex} agentId={line.agentId} numberHeight={rowHeight} />
      </div>

      <div className={cn("flex-1 border-b border-(--divider) relative", mainWords && "overflow-hidden")}>
        <div className="absolute inset-0 pointer-events-none" style={{ transform: shiftTransform }}>
          {groupColor && (
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none z-0"
              style={{ background: groupColor, opacity: 0.04 }}
            />
          )}
        </div>
        <div
          data-line-index={lineIndex}
          data-track="word"
          className={cn("relative", !mainWords && "opacity-50", hoveredTrack === "word" && "bg-composer-accent/10")}
          style={{ transform: shiftTransform }}
        >
          {mainWords ? (
            <WordTrack
              lineId={line.id}
              lineIndex={lineIndex}
              words={mainWords}
              color={color}
              trackType="word"
              duration={duration}
              height={rowHeight}
              onUpdateWord={onUpdateWord}
            />
          ) : (
            <EmptyWordTrack line={line} lineIndex={lineIndex} duration={duration} rowHeight={rowHeight} />
          )}
        </div>

        {bgWords ? (
          <div
            data-line-index={lineIndex}
            data-track="bg"
            className={cn(
              "relative shadow-[inset_0_1px_0_var(--divider)]",
              hoveredTrack === "bg"
                ? "bg-composer-accent/10"
                : "bg-[color-mix(in_oklab,var(--color-composer-bg-dark)_35%,transparent)]",
            )}
            style={{ transform: shiftTransform }}
          >
            <WordTrack
              lineId={line.id}
              lineIndex={lineIndex}
              words={bgWords}
              color={color}
              trackType="bg"
              duration={duration}
              height={rowHeight}
              onUpdateWord={onUpdateBgWord}
            />
          </div>
        ) : (
          <EmptyBgTrack line={line} lineIndex={lineIndex} isOver={hoveredTrack === "bg"} />
        )}
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-hidden="true"
        className={cn(
          "absolute left-0 right-0 bottom-0 h-1 cursor-ns-resize hover:bg-composer-accent/30 z-10",
          isResizing && "bg-composer-accent/50",
        )}
        onMouseDown={startResize}
        onDoubleClick={resetHeight}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

const MemoizedLineRow = memo(LineRow);
export { MemoizedLineRow as LineRow };
