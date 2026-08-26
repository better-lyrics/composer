import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useAudioStore } from "@/stores/audio";
import { formatTimeMs } from "@/utils/sync-helpers";
import { useRef } from "react";

// -- Interfaces ---------------------------------------------------------------

interface TimingDisplayProps {
  lastSyncedTime?: number;
}

// -- Components ---------------------------------------------------------------

const TimingDisplay: React.FC<TimingDisplayProps> = ({ lastSyncedTime }) => {
  const currentTimeRef = useRef<HTMLDivElement>(null);

  useFrameLoop(() => {
    const el = currentTimeRef.current;
    if (el) {
      const audioEl = useAudioStore.getState().audioElement;
      const time = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
      el.textContent = formatTimeMs(time);
    }
  }, "timing-display");

  return (
    <div className="flex items-center justify-center gap-8 font-mono text-sm select-text tabular-nums">
      <div className="text-center">
        <div className="mb-1 text-xs text-composer-text-muted">Current</div>
        <div ref={currentTimeRef} className="text-xl text-composer-text">
          0:00.000
        </div>
      </div>
      {lastSyncedTime !== undefined && (
        <div className="text-center">
          <div className="mb-1 text-xs text-composer-text-muted">Last Synced</div>
          <div className="text-xl text-composer-accent-text">{formatTimeMs(lastSyncedTime)}</div>
        </div>
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimingDisplay };
