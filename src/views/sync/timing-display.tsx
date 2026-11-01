import { useFrameLoop } from "@/hooks/use-frame-loop";
import { livePlaybackTime } from "@/stores/audio";
import { formatTimeMs } from "@/utils/sync-helpers";
import { useRef } from "react";

// -- Interfaces ---------------------------------------------------------------

interface TimingDisplayProps {
  lastSyncedTime?: number;
}

// -- Components ---------------------------------------------------------------

const TimingDisplay: React.FC<TimingDisplayProps> = ({ lastSyncedTime }) => {
  const currentTimeRef = useRef<HTMLSpanElement>(null);

  useFrameLoop(() => {
    const el = currentTimeRef.current;
    if (el) {
      const time = livePlaybackTime();
      el.textContent = formatTimeMs(time);
    }
  }, "timing-display");

  return (
    <div className="flex gap-8 select-text">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-(--muted) select-none">Current</span>
        <span ref={currentTimeRef} className="font-mono text-xl leading-[26px] tabular-nums text-composer-text">
          0:00.000
        </span>
      </div>
      {lastSyncedTime !== undefined && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-(--muted) select-none">Last synced</span>
          <span className="font-mono text-xl leading-[26px] tabular-nums text-composer-accent-text">
            {formatTimeMs(lastSyncedTime)}
          </span>
        </div>
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimingDisplay };
