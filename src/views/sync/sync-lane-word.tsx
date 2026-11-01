import { syncTapRingTransition, syncTapRingVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { m } from "motion/react";

// -- Types --------------------------------------------------------------------

type SlotState = "next" | "lastTapped" | "timed" | "untimed";

// -- Constants ----------------------------------------------------------------

const SLOT_TEXT_CLASS: Record<Exclude<SlotState, "untimed">, string> = {
  next: "text-composer-text",
  lastTapped: "text-composer-accent-text",
  timed: "text-sync-timed",
};

const INSTANT_COLOR_STATES: ReadonlySet<SlotState> = new Set(["next", "lastTapped"]);

// -- Interfaces ---------------------------------------------------------------

interface LaneWordProps {
  state: SlotState;
  onCurrentLine: boolean;
  isHeld?: boolean;
  onClick?: () => void;
  dimmed?: boolean;
  children: React.ReactNode;
}

interface TapRingProps {
  onComplete: () => void;
}

// -- Components ---------------------------------------------------------------

const TapRing: React.FC<TapRingProps> = ({ onComplete }) => (
  <m.span
    aria-hidden
    className="absolute -inset-x-2 -inset-y-1 rounded-lg pointer-events-none shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--color-composer-accent)_55%,transparent)]"
    variants={syncTapRingVariants}
    initial="initial"
    animate="animate"
    transition={syncTapRingTransition}
    onAnimationComplete={onComplete}
  />
);

function wordTextClass(state: SlotState, onCurrentLine: boolean, dimmed: boolean): string {
  if (dimmed) return "text-composer-text-faint";
  if (state !== "untimed") return SLOT_TEXT_CLASS[state];
  return onCurrentLine ? "text-composer-text-secondary" : "text-composer-text-faint";
}

const LaneWord: React.FC<LaneWordProps> = ({
  state,
  onCurrentLine,
  isHeld = false,
  onClick,
  dimmed = false,
  children,
}) => (
  <span
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? -1 : undefined}
    onClick={onClick}
    className={cn(
      "group/word relative inline-flex items-center justify-center origin-center ease-out motion-reduce:transition-none",
      INSTANT_COLOR_STATES.has(state) ? "transition-[scale] duration-150" : "transition-[color,scale] duration-400",
      isHeld && "scale-96",
      onClick && "cursor-pointer",
      wordTextClass(state, onCurrentLine, dimmed),
    )}
  >
    <span
      aria-hidden
      className={cn(
        "absolute -inset-x-2 -inset-y-1 rounded-lg transition-opacity duration-150 ease-out motion-reduce:transition-none",
        isHeld ? "bg-composer-accent/25" : "bg-composer-accent/15",
        state === "next" ? "opacity-100" : "opacity-0",
        onClick && state !== "next" && "group-hover/word:opacity-60",
      )}
    />
    {children}
  </span>
);

// -- Exports ------------------------------------------------------------------

export { LaneWord, TapRing };
export type { SlotState };
