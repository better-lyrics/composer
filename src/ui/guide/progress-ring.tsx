import { cn } from "@/utils/cn";

// -- Constants ----------------------------------------------------------------

const RING_RADIUS = 15;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// -- Components ---------------------------------------------------------------

const ProgressRing: React.FC<{ progress: number; className?: string }> = ({ progress, className }) => (
  <svg viewBox="0 0 36 36" className={cn("size-9 -rotate-90", className)} aria-hidden>
    <circle cx="18" cy="18" r={RING_RADIUS} fill="none" stroke="var(--layer-2)" strokeWidth="2" />
    <circle
      cx="18"
      cy="18"
      r={RING_RADIUS}
      fill="none"
      stroke="var(--color-composer-accent)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray={RING_LENGTH}
      strokeDashoffset={RING_LENGTH * (1 - progress)}
      className="transition-[stroke-dashoffset] duration-500 ease-out"
    />
  </svg>
);

// -- Exports ------------------------------------------------------------------

export { ProgressRing };
