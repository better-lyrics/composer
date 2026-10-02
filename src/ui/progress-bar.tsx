import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

type ProgressBarTone = "default" | "on-media";

interface ProgressBarProps {
  percent: number;
  label: string;
  tone?: ProgressBarTone;
  className?: string;
}

// -- Constants ----------------------------------------------------------------

const TRACK_STYLES: Record<ProgressBarTone, string> = {
  default: "h-1 bg-composer-button",
  "on-media": "h-1.5 bg-white/16",
};

const FILL_STYLES: Record<ProgressBarTone, string> = {
  default: "bg-composer-accent",
  "on-media": "bg-white",
};

// -- Component ----------------------------------------------------------------

const ProgressBar: React.FC<ProgressBarProps> = ({ percent, label, tone = "default", className }) => {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative overflow-hidden rounded-full", TRACK_STYLES[tone], className)}
    >
      <span
        className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-150", FILL_STYLES[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProgressBar };
