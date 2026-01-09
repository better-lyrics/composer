import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { TimelineControls } from "@/views/timeline/timeline-controls";
import { TimelineWaveform } from "@/views/timeline/timeline-waveform";
import { useState } from "react";

// -- Components ----------------------------------------------------------------

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
  </div>
);

const TimelinePanel: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const lines = useProjectStore((s) => s.lines);
  const [rippleEnabled, setRippleEnabled] = useState(false);

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
        />
      </div>
      <div className="flex-1 p-4">
        <TimelineWaveform lines={lines} rippleEnabled={rippleEnabled} />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePanel };
