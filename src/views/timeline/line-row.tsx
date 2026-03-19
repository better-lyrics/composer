import { type LyricLine, type WordTiming, getAgentColor } from "@/stores/project";
import { cn } from "@/utils/cn";
import { GutterAgentPicker } from "@/views/timeline/gutter-agent-picker";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordTrack } from "@/views/timeline/word-track";
import { useDroppable } from "@dnd-kit/core";
import { memo, useCallback, useEffect, useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface LineRowProps {
  line: LyricLine;
  lineIndex: number;
  duration: number;
  onUpdateWord: (wordIndex: number, updates: Partial<WordTiming>) => void;
  onUpdateBgWord: (wordIndex: number, updates: Partial<WordTiming>) => void;
}

// -- Constants -----------------------------------------------------------------

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
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

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
      if (e.button !== 0) return;
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
        cleanupRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      cleanupRef.current = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [line.id, rowHeight, setRowHeight],
  );

  return (
    <div className="relative flex">
      <div
        className="shrink-0 flex items-center justify-center text-xs text-composer-text-muted border-r-2 shadow-[inset_0_-1px_0_0_var(--color-composer-border)] bg-composer-bg w-12 sticky left-0 z-60"
        style={{ borderRightColor: color }}
      >
        <GutterAgentPicker lineId={line.id} lineIndex={lineIndex} agentId={line.agentId} />
      </div>

      <div className="flex-1 overflow-hidden border-b border-composer-border">
        <div
          ref={setMainDropRef}
          className={cn("transition-colors", !hasMainWords && "opacity-50", isOverMain && "bg-composer-accent/10")}
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

        {hasBgWords ? (
          <div
            ref={setBgDropRef}
            className={cn(
              "relative opacity-70 transition-colors border-t border-composer-border/50",
              isOverBg ? "bg-composer-accent/10" : "bg-composer-bg-elevated/25",
            )}
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
              "flex items-center px-2 text-xs font-mono truncate transition-colors border-t border-composer-border/30",
              isOverBg
                ? "bg-composer-accent/20 text-composer-text"
                : "text-composer-text-muted/50 bg-composer-bg-elevated/25",
            )}
            style={{ height: BG_DROP_ZONE_HEIGHT }}
          >
            {line.backgroundText
              ? `${line.backgroundText.slice(0, 40)}${line.backgroundText.length > 40 ? "..." : ""}`
              : "BG"}
          </div>
        )}
      </div>

      <div
        className={cn(
          "absolute left-0 right-0 bottom-0 h-1 cursor-ns-resize hover:bg-composer-accent/30 transition-colors z-10",
          isResizing && "bg-composer-accent/50",
        )}
        onMouseDown={handleResizeStart}
        onDoubleClick={() => setRowHeight(line.id, defaultRowHeight)}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

const MemoizedLineRow = memo(LineRow);
export { MemoizedLineRow as LineRow };
