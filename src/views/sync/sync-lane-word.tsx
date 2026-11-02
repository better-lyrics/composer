import { syncTapRingTransition, syncTapRingVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { m } from "motion/react";

// -- Types --------------------------------------------------------------------

type SlotState = "next" | "lastTapped" | "plain";

// -- Constants ----------------------------------------------------------------

const INSTANT_COLOR_STATES: ReadonlySet<SlotState> = new Set(["next", "lastTapped"]);

// -- Interfaces ---------------------------------------------------------------

interface LaneWordProps {
  state: SlotState;
  onCurrentLine: boolean;
  isHeld?: boolean;
  dimmed?: boolean;
  hasDot?: boolean;
  children: React.ReactNode;
}

interface TapRingProps {
  onComplete: () => void;
}

// -- Components ---------------------------------------------------------------

const TapRing: React.FC<TapRingProps> = ({ onComplete }) => (
  <m.span
    aria-hidden
    className="absolute inset-0 rounded-[50%] border border-composer-accent/20 bg-composer-accent/20 pointer-events-none blur-sm"
    variants={syncTapRingVariants}
    initial="initial"
    animate="animate"
    transition={syncTapRingTransition}
    onAnimationComplete={onComplete}
  />
);

function wordTextClass(state: SlotState, onCurrentLine: boolean, isHeld: boolean, dimmed: boolean): string {
  if (dimmed) return "text-composer-text-faint";
  if (state === "lastTapped" || isHeld) return "text-composer-accent-text";
  return onCurrentLine ? "text-composer-text-secondary" : "text-composer-text-faint";
}

const LaneWord: React.FC<LaneWordProps> = ({
  state,
  onCurrentLine,
  isHeld = false,
  dimmed = false,
  hasDot = false,
  children,
}) => (
  <span
    className={cn(
      "relative inline-flex items-center justify-center origin-center ease-out motion-reduce:transition-none",
      INSTANT_COLOR_STATES.has(state) ? "transition-[scale] duration-150" : "transition-[color,scale] duration-400",
      isHeld && "scale-96",
      wordTextClass(state, onCurrentLine, isHeld, dimmed),
    )}
  >
    {children}
    {hasDot && (
      <span
        aria-hidden
        className="absolute left-1/2 -bottom-4 size-1.5 -translate-x-1/2 rounded-full bg-current opacity-60 pointer-events-none"
      />
    )}
  </span>
);

// -- Exports ------------------------------------------------------------------

export { LaneWord, TapRing };
export type { SlotState };
