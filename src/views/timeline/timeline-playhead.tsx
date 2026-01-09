import { useAudioStore } from "@/stores/audio";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback, useRef } from "react";

// -- Types ---------------------------------------------------------------------

interface TimelinePlayheadProps {
  containerHeight: number;
}

// -- Constants -----------------------------------------------------------------

const GUTTER_WIDTH = 48;

// -- Component -----------------------------------------------------------------

const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({ containerHeight }) => {
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const seekTo = useAudioStore((s) => s.seekTo);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);

  const zoom = useTimelineStore((s) => s.zoom);
  const scrollLeft = useTimelineStore((s) => s.scrollLeft);
  const isDragging = useTimelineStore((s) => s.isDraggingPlayhead);
  const dragTime = useTimelineStore((s) => s.dragTime);
  const setDraggingPlayhead = useTimelineStore((s) => s.setDraggingPlayhead);
  const setDragTime = useTimelineStore((s) => s.setDragTime);

  const containerRef = useRef<HTMLDivElement>(null);

  const displayTime = isDragging ? dragTime : currentTime;
  const position = displayTime * zoom - scrollLeft + GUTTER_WIDTH;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsPlaying(false);
      setDraggingPlayhead(true, currentTime);

      const parentRect = containerRef.current?.getBoundingClientRect();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!parentRect) return;
        const x = moveEvent.clientX - parentRect.left - GUTTER_WIDTH + scrollLeft;
        const newTime = Math.max(0, Math.min(duration, x / zoom));
        setDragTime(newTime);
      };

      const handleMouseUp = (moveEvent: MouseEvent) => {
        if (parentRect) {
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
    [scrollLeft, duration, zoom, seekTo, setIsPlaying, currentTime, setDraggingPlayhead, setDragTime],
  );

  if (duration === 0) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      <div
        className="absolute top-0 w-0.5 bg-indigo-400 cursor-ew-resize pointer-events-auto -translate-x-1/2"
        style={{ left: position, height: containerHeight }}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-0 -left-1.5 w-3.5 h-3 bg-indigo-400 rounded-t" />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePlayhead };
