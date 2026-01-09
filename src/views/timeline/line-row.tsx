import { useDroppable } from "@dnd-kit/core";
import { getAgentColor, type LyricLine, type WordTiming } from "@/stores/project";
import { WordTrack } from "@/views/timeline/word-track";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { cn } from "@/utils/cn";
import { useCallback, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface LineRowProps {
  line: LyricLine;
  lineIndex: number;
  duration: number;
  onUpdateWord: (wordIndex: number, updates: Partial<WordTiming>) => void;
  onUpdateBgWord: (wordIndex: number, updates: Partial<WordTiming>) => void;
}

// -- Constants -----------------------------------------------------------------

const GUTTER_WIDTH = 48;
const BG_DROP_ZONE_HEIGHT = 24;

// -- Component -----------------------------------------------------------------

const LineRow: React.FC<LineRowProps> = ({ line, lineIndex, duration, onUpdateWord, onUpdateBgWord }) => {
  const color = getAgentColor(line.agentId);
  const hasBgWords = line.backgroundWords && line.backgroundWords.length > 0;
  const hasMainWords = line.words && line.words.length > 0;

  const rowHeight = useTimelineStore((s) => s.rowHeights[line.id] ?? s.defaultRowHeight);
  const defaultRowHeight = useTimelineStore((s) => s.defaultRowHeight);
  const setRowHeight = useTimelineStore((s) => s.setRowHeight);

  const [isResizing, setIsResizing] = useState(false);

  const { setNodeRef: setBgDropRef, isOver: isOverBg } = useDroppable({
    id: `bg-drop-${line.id}`,
    data: { lineId: line.id, lineIndex },
  });

  const { setNodeRef: setMainDropRef, isOver: isOverMain } = useDroppable({
    id: `main-drop-${line.id}`,
    data: { lineId: line.id, lineIndex },
  });

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startY = e.clientY;
      const startHeight = rowHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientY - startY;
        setRowHeight(line.id, startHeight + delta);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [line.id, rowHeight, setRowHeight],
  );

  return (
    <div className="relative flex border-b border-composer-border/50">
      {/* Gutter */}
      <div className="shrink-0 flex items-center justify-center text-xs text-composer-text-muted border-r border-composer-border/50 bg-composer-bg w-12">
        {lineIndex + 1}
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-hidden">
        {/* Main word track - droppable for BG words */}
        <div
          ref={setMainDropRef}
          className={cn(
            "border-l transition-colors",
            !hasMainWords && "opacity-50",
            isOverMain && "bg-composer-accent/10",
          )}
          style={{ borderColor: color }}
        >
          {hasMainWords ? (
            <WordTrack
              lineId={line.id}
              lineIndex={lineIndex}
              words={line.words!}
              color={color}
              trackType="word"
              duration={duration}
              height={rowHeight}
              onUpdateWord={onUpdateWord}
            />
          ) : (
            <div
              className="flex items-center px-3 text-xs text-composer-text-muted italic truncate"
              style={{ height: rowHeight }}
            >
              {line.text.slice(0, 60)}
              {line.text.length > 60 ? "..." : ""}
            </div>
          )}
        </div>

        {/* BG word track / drop zone */}
        {hasBgWords ? (
          <div
            ref={setBgDropRef}
            className={cn(
              "relative border-l opacity-70 transition-colors",
              isOverBg ? "bg-composer-accent/10" : "bg-composer-bg-elevated/25",
            )}
            style={{ borderColor: color }}
          >
            <WordTrack
              lineId={line.id}
              lineIndex={lineIndex}
              words={line.backgroundWords!}
              color={color}
              trackType="bg"
              duration={duration}
              height={rowHeight}
              onUpdateWord={onUpdateBgWord}
            />
          </div>
        ) : (
          <div
            ref={setBgDropRef}
            className={cn(
              "flex items-center px-2 text-xs font-mono truncate border-l transition-colors",
              isOverBg
                ? "bg-composer-accent/20 text-composer-text"
                : "text-composer-text-muted/50 bg-composer-bg-elevated/25",
            )}
            style={{ height: BG_DROP_ZONE_HEIGHT, borderColor: `${color}` }}
          >
            {line.backgroundText
              ? `${line.backgroundText.slice(0, 40)}${line.backgroundText.length > 40 ? "..." : ""}`
              : "BG"}
          </div>
        )}
      </div>

      {/* Row resize handle */}
      <div
        className={cn(
          "absolute left-0 right-0 bottom-0 h-1 cursor-ns-resize hover:bg-composer-accent/30 transition-colors z-20",
          isResizing && "bg-composer-accent/50",
        )}
        onMouseDown={handleResizeStart}
        onDoubleClick={() => setRowHeight(line.id, defaultRowHeight)}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { LineRow, GUTTER_WIDTH };
