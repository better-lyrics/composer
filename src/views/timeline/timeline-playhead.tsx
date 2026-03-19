import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { getLineTiming } from "@/views/timeline/utils";
import { useCallback, useEffect, useRef } from "react";

// -- Types ---------------------------------------------------------------------

interface TimelinePlayheadProps {
  containerHeight: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// -- Component -----------------------------------------------------------------

const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({ containerHeight, scrollContainerRef }) => {
  const duration = useAudioStore((s) => s.duration);
  const seekTo = useAudioStore((s) => s.seekTo);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);

  const setDraggingPlayhead = useTimelineStore((s) => s.setDraggingPlayhead);
  const setDragTime = useTimelineStore((s) => s.setDragTime);

  const containerRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastFollowedLineRef = useRef<number>(-1);
  const verticalTargetRef = useRef<number | null>(null);

  // RAF loop - always runs, reads directly from audio element and stores
  useEffect(() => {
    const update = () => {
      if (!playheadRef.current) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      // Read directly from audio element for smooth updates
      const audioEl = useAudioStore.getState().audioElement;
      const isPlaying = useAudioStore.getState().isPlaying;
      const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
      const { zoom, scrollLeft, isDraggingPlayhead, dragTime, followEnabled } = useTimelineStore.getState();

      // Auto-scroll to keep playhead centered when follow is enabled
      const container = scrollContainerRef.current;
      if (followEnabled && isPlaying && container && !isDraggingPlayhead) {
        const viewportWidth = container.clientWidth;
        const centerOffset = viewportWidth / 2 - GUTTER_WIDTH;
        const targetScrollLeft = Math.max(0, currentTime * zoom - centerOffset);
        container.scrollLeft = targetScrollLeft;

        const lines = useProjectStore.getState().lines;
        let activeLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          const timing = getLineTiming(lines[i]);
          if (timing && currentTime >= timing.begin && currentTime < timing.end) {
            activeLineIndex = i;
            break;
          }
        }

        if (activeLineIndex >= 0 && activeLineIndex !== lastFollowedLineRef.current) {
          lastFollowedLineRef.current = activeLineIndex;
          const WAVEFORM_HEIGHT = 80;
          const BG_DROP_ZONE_HEIGHT = 24;
          const { rowHeights, defaultRowHeight } = useTimelineStore.getState();

          let rowTop = WAVEFORM_HEIGHT;
          for (let i = 0; i < activeLineIndex; i++) {
            const l = lines[i];
            const mainHeight = rowHeights[l.id] ?? defaultRowHeight;
            const hasBg = l.backgroundWords && l.backgroundWords.length > 0;
            rowTop += mainHeight + (hasBg ? mainHeight : BG_DROP_ZONE_HEIGHT) + 1;
          }
          const line = lines[activeLineIndex];
          const mainHeight = rowHeights[line.id] ?? defaultRowHeight;
          const hasBg = line.backgroundWords && line.backgroundWords.length > 0;
          const rowHeight = mainHeight + (hasBg ? mainHeight : BG_DROP_ZONE_HEIGHT) + 1;

          const viewportHeight = container.clientHeight;
          const rowCenter = rowTop + rowHeight / 2;
          verticalTargetRef.current = Math.max(
            0,
            Math.min(container.scrollHeight - viewportHeight, rowCenter - viewportHeight / 2),
          );
        }

        // Lerp vertical scroll only while animating toward target
        if (verticalTargetRef.current !== null) {
          const diff = verticalTargetRef.current - container.scrollTop;
          if (Math.abs(diff) > 0.5) {
            container.scrollTop += diff * 0.15;
          } else {
            container.scrollTop = verticalTargetRef.current;
            verticalTargetRef.current = null;
          }
        }
      } else {
        lastFollowedLineRef.current = -1;
        verticalTargetRef.current = null;
      }

      container?.classList.toggle("scrollbar-hidden", isPlaying && followEnabled);

      const displayTime = isDraggingPlayhead ? dragTime : currentTime;
      const actualScrollLeft = container?.scrollLeft ?? scrollLeft;
      const position = displayTime * zoom - actualScrollLeft + GUTTER_WIDTH - 1; // -1 to center the 2px wide playhead
      playheadRef.current.style.transform = `translate3d(${position}px, 0, 0)`;

      // Update height to match full scrollable content
      if (container) {
        playheadRef.current.style.height = `${container.scrollHeight}px`;
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollContainerRef]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setIsPlaying(false);

      const audioEl = useAudioStore.getState().audioElement;
      const actualTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
      setDraggingPlayhead(true, actualTime);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const parentRect = containerRef.current?.getBoundingClientRect();
        if (!parentRect) return;
        const { scrollLeft, zoom } = useTimelineStore.getState();
        const x = moveEvent.clientX - parentRect.left - GUTTER_WIDTH + scrollLeft;
        const newTime = Math.max(0, Math.min(duration, x / zoom));
        setDragTime(newTime);
      };

      const handleMouseUp = (moveEvent: MouseEvent) => {
        const parentRect = containerRef.current?.getBoundingClientRect();
        if (parentRect) {
          const { scrollLeft, zoom } = useTimelineStore.getState();
          const x = moveEvent.clientX - parentRect.left - GUTTER_WIDTH + scrollLeft;
          const finalTime = Math.max(0, Math.min(duration, x / zoom));
          seekTo(finalTime);
        }
        setDraggingPlayhead(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [duration, seekTo, setIsPlaying, setDraggingPlayhead, setDragTime],
  );

  if (duration === 0) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      <div
        ref={playheadRef}
        className="absolute top-0 left-0 w-0.5 bg-indigo-400 cursor-ew-resize pointer-events-auto expanded-hit-x-sm"
        style={{
          height: containerHeight,
          willChange: "transform",
          transition: "transform 32ms linear",
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-0 -left-1.5 w-3.5 h-3 bg-indigo-400 rounded-t expanded-hit-lg" />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePlayhead };
