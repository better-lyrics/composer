import { formatTimeMs } from "@/utils/sync-helpers";

// -- Interfaces ---------------------------------------------------------------

interface TimingDisplayProps {
  currentTime: number;
  lastSyncedTime?: number;
}

// -- Components ---------------------------------------------------------------

const TimingDisplay: React.FC<TimingDisplayProps> = ({ currentTime, lastSyncedTime }) => {
  return (
    <div className="flex items-center justify-center gap-8 font-mono text-sm select-text tabular-nums">
      <div className="text-center">
        <div className="mb-1 text-xs text-composer-text-muted">Current</div>
        <div className="text-xl text-composer-text">{formatTimeMs(currentTime)}</div>
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
