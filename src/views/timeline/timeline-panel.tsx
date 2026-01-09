import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { TimelineControls } from "@/views/timeline/timeline-controls";
import { TimelineWaveform } from "@/views/timeline/timeline-waveform";
import { useEffect, useState } from "react";

// -- Components ----------------------------------------------------------------

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
  </div>
);

const TimelinePanel: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const currentTime = useAudioStore((s) => s.currentTime);
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
  const lines = useProjectStore((s) => s.lines);
  const [rippleEnabled, setRippleEnabled] = useState(false);
  const [loopRegion, setLoopRegion] = useState<{ start: number; end: number } | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);

  // Loop playback logic
  useEffect(() => {
    if (!loopEnabled || !loopRegion) return;

    if (currentTime >= loopRegion.end) {
      setCurrentTime(loopRegion.start);
    }
  }, [currentTime, loopEnabled, loopRegion, setCurrentTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "l" || e.key === "L") {
        if (loopRegion) setLoopEnabled((prev) => !prev);
      } else if (e.key === "Escape") {
        setLoopRegion(null);
        setLoopEnabled(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loopRegion]);

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
      <div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
        <h2 className="text-lg font-medium">Timeline</h2>
        <TimelineControls
          rippleEnabled={rippleEnabled}
          onToggleRipple={() => setRippleEnabled(!rippleEnabled)}
          loopRegion={loopRegion}
          loopEnabled={loopEnabled}
          onToggleLoop={() => setLoopEnabled(!loopEnabled)}
          onClearLoop={() => {
            setLoopRegion(null);
            setLoopEnabled(false);
          }}
        />
      </div>
      <div className="flex-1 p-4">
        <TimelineWaveform
          lines={lines}
          rippleEnabled={rippleEnabled}
          loopRegion={loopRegion}
          onLoopRegionChange={setLoopRegion}
        />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePanel };
