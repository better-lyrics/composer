import { useAudioStore } from "@/stores/audio";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback } from "react";

// -- Types ---------------------------------------------------------------------

interface TimelinePlayheadProps {
  containerHeight: number;
}

// -- Constants -----------------------------------------------------------------

const GUTTER_WIDTH = 48;

// -- Component -----------------------------------------------------------------

const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  containerHeight,
}) => {
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);

  const zoom = useTimelineStore((s) => s.zoom);
  const scrollLeft = useTimelineStore((s) => s.scrollLeft);

  const position = currentTime * zoom - scrollLeft + GUTTER_WIDTH;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsPlaying(false);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const rect = (
          e.target as HTMLElement
        ).parentElement?.getBoundingClientRect();
        if (!rect) return;
        const x = moveEvent.clientX - rect.left - GUTTER_WIDTH + scrollLeft;
        const newTime = Math.max(0, Math.min(duration, x / zoom));
        setCurrentTime(newTime);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [scrollLeft, duration, zoom, setCurrentTime, setIsPlaying]
  );

  if (duration === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      <div
        className="absolute top-0 w-0.5 bg-indigo-400 cursor-ew-resize pointer-events-auto -translate-x-1/2"
        style={{ left: position, height: containerHeight }}
        onMouseDown={handleMouseDown}
      >
        {/* Playhead handle */}
        <div className="absolute top-0 -left-1.5 w-3.5 h-3 bg-indigo-400 rounded-t" />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePlayhead };
