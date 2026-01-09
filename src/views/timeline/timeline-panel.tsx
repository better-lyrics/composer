import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { TimelineHeader } from "@/views/timeline/timeline-header";
import { TimelineWaveform } from "@/views/timeline/timeline-waveform";
import { TimelineRows } from "@/views/timeline/timeline-rows";
import { TimelinePlayhead } from "@/views/timeline/timeline-playhead";
import { TimelineInfoPanel } from "@/views/timeline/timeline-info-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { distributeLinesTiming } from "@/views/timeline/utils";
import { useEffect, useRef, useState } from "react";

// -- Components ----------------------------------------------------------------

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
  </div>
);

const TimelinePanel: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const duration = useAudioStore((s) => s.duration);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);

  const lines = useProjectStore((s) => s.lines);
  const setLines = useProjectStore((s) => s.setLines);

  const setSelectedWord = useTimelineStore((s) => s.setSelectedWord);

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(400);

  // Initialize timing if lines have no timing
  useEffect(() => {
    if (duration <= 0 || lines.length === 0) return;

    const hasAnyTiming = lines.some(
      (l) => l.words?.length || (l.begin !== undefined && l.end !== undefined)
    );

    if (!hasAnyTiming) {
      const distributed = distributeLinesTiming(lines, duration);
      setLines(distributed);
    }
  }, [duration, lines, setLines]);

  // Track content height for playhead
  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContentHeight(entries[0].contentRect.height);
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === " ") {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      } else if (e.key === "Escape") {
        setSelectedWord(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, setIsPlaying, setSelectedWord]);

  if (!source) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No audio loaded" hint="Import audio in the Import tab first" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No lyrics to display" hint="Add lyrics in the Edit tab first" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden select-none">
      <TimelineHeader />

      <div ref={contentRef} className="relative flex-1 flex flex-col overflow-hidden">
        {/* Sticky waveform */}
        <div className="flex-shrink-0 border-b border-composer-border bg-composer-bg">
          <TimelineWaveform />
        </div>

        {/* Scrollable rows */}
        <TimelineRows />

        {/* Playhead overlay */}
        <TimelinePlayhead containerHeight={contentHeight} />
      </div>

      <TimelineInfoPanel />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePanel };
