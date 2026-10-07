import { livePlaybackTime } from "@/stores/audio";
import { CountdownRing } from "@/ui/countdown-ring";
import { pluralize } from "@/utils/pluralize";

// -- Interfaces ---------------------------------------------------------------

interface PrerollStatusProps {
  end: number;
  seconds: number;
  lineNumber: number;
}

// -- Components ---------------------------------------------------------------

const PrerollStatus: React.FC<PrerollStatusProps> = ({ end, seconds, lineNumber }) => {
  const label = `Line ${lineNumber} in`;
  return (
    <div className="flex items-center gap-2.5 text-sm text-composer-text-muted">
      <span aria-hidden="true">{label}</span>
      <CountdownRing
        remainingSeconds={() => end - livePlaybackTime()}
        totalSeconds={seconds}
        precision={1}
        announce={(left) => `${label} ${pluralize(left, "second")}`}
      />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { PrerollStatus };
