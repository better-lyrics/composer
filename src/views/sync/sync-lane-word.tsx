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

type SyllableDot = "plain" | "soon";

interface LaneWordProps {
  state: SlotState;
  onCurrentLine: boolean;
  isHeld?: boolean;
  onClick?: () => void;
  dimmed?: boolean;
  joinedStart?: boolean;
  joinedEnd?: boolean;
  dot?: SyllableDot;
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

function dotClass(dot: SyllableDot, state: SlotState, onCurrentLine: boolean): string {
  if (state !== "untimed") return "bg-current";
  if (dot === "soon") return "bg-composer-accent-text";
  return cn("bg-current", onCurrentLine ? "opacity-80" : "opacity-55");
}

// Clicking a word must not focus it, or the tap key (Space) would also press it.
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

const LaneWord: React.FC<LaneWordProps> = ({
  state,
  onCurrentLine,
  isHeld = false,
  onClick,
  dimmed = false,
  joinedStart = false,
  joinedEnd = false,
  dot,
  children,
}) => {
  const className = cn(
    "group/word relative inline-flex items-center justify-center origin-center ease-out motion-reduce:transition-none",
    INSTANT_COLOR_STATES.has(state) ? "transition-[scale] duration-150" : "transition-[color,scale] duration-400",
    isHeld && "scale-96",
    onClick && "cursor-pointer",
    wordTextClass(state, onCurrentLine, dimmed),
  );
  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          "absolute -inset-x-2 -inset-y-1 rounded-lg transition-opacity duration-150 ease-out motion-reduce:transition-none",
          joinedStart && "-left-0.5 rounded-l-sm",
          joinedEnd && "-right-0.5 rounded-r-sm",
          isHeld ? "bg-composer-accent/25" : "bg-composer-accent/15",
          state === "next" ? "opacity-100" : "opacity-0",
          onClick && state !== "next" && "group-hover/word:opacity-60",
        )}
      />
      {children}
      {dot && (
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 -bottom-4 size-1.5 -translate-x-1/2 rounded-full pointer-events-none transition-[opacity,background-color] duration-150 ease-out motion-reduce:transition-none",
            dotClass(dot, state, onCurrentLine),
          )}
        />
      )}
    </>
  );
  if (!onClick) return <span className={className}>{content}</span>;
  return (
    <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={onClick} className={className}>
      {content}
    </button>
  );
};

// -- Exports ------------------------------------------------------------------

export { LaneWord, TapRing };
export type { SlotState, SyllableDot };
