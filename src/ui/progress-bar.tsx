import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

type ProgressBarTone = "default" | "on-media";

interface ProgressBarProps {
  percent: number;
  label: string;
  tone?: ProgressBarTone;
  segments?: number;
  className?: string;
}

// -- Constants ----------------------------------------------------------------

const TRACK_STYLES: Record<ProgressBarTone, string> = {
  default: "h-1 bg-(--layer-2)",
  "on-media": "h-1.5 bg-white/16",
};

const FILL_STYLES: Record<ProgressBarTone, string> = {
  default: "bg-composer-accent",
  "on-media": "bg-white",
};

const SEGMENT_LIT_STYLES: Record<ProgressBarTone, string> = {
  default: "bg-composer-accent",
  "on-media":
    "bg-[color-mix(in_oklab,var(--color-composer-accent)_85%,white)] shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.12)]",
};

const SEGMENT_OFF_STYLES: Record<ProgressBarTone, string> = {
  default: "bg-(--layer-2)",
  "on-media": "bg-white/14",
};

// -- Component ----------------------------------------------------------------

const ProgressBar: React.FC<ProgressBarProps> = ({ percent, label, tone = "default", segments, className }) => {
  const clamped = Math.min(100, Math.max(0, percent));
  if (segments !== undefined) {
    const litCount = Math.round((clamped / 100) * segments);
    return (
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn("grid grid-flow-col auto-cols-fr gap-[3px] h-2.5", className)}
      >
        {Array.from({ length: segments }, (_, index) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: segments are a fixed, ordered strip
            key={index}
            className={cn("rounded-[2px]", index < litCount ? SEGMENT_LIT_STYLES[tone] : SEGMENT_OFF_STYLES[tone])}
          />
        ))}
      </div>
    );
  }
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
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-linear",
          FILL_STYLES[tone],
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProgressBar };
