import { syncCarouselTransition } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { stripSplitCharacter } from "@/utils/split-character";
import { splitIntoWords } from "@/utils/sync-helpers";
import type { SharedSyncTag } from "@/views/sync/shared-sync-tags";
import { IconLink } from "@tabler/icons-react";
import { AnimatePresence, m } from "motion/react";

// -- Types --------------------------------------------------------------------

type SlotState = "next" | "lastTapped" | "timed" | "untimed";

// -- Constants ----------------------------------------------------------------

const LINE_HEIGHT = 100;

const SLOT_TEXT_CLASS: Record<Exclude<SlotState, "untimed">, string> = {
  next: "text-composer-text",
  lastTapped: "text-composer-accent-text",
  timed: "text-[color-mix(in_oklab,var(--color-composer-accent-text)_55%,var(--color-composer-text-faint))]",
};

// -- Interfaces ---------------------------------------------------------------

interface RippleTarget {
  lineId: string;
  wordIndex: number;
  nonce: number;
}

interface SyncCarouselProps {
  lines: Array<{
    id: string;
    text: string;
    displayText?: string;
    displayWordTexts?: string[];
    isTimed: boolean;
    timedWords: number;
    sharedTag?: SharedSyncTag;
  }>;
  lineIndex: number;
  wordIndex: number;
  granularity: "line" | "word";
  isHolding?: boolean;
  rippleTarget?: RippleTarget | null;
  onRippleComplete?: () => void;
  aboveCurrent?: React.ReactNode;
}

// -- Components ---------------------------------------------------------------

const RippleRing: React.FC<{ onComplete: () => void }> = ({ onComplete }) => (
  <m.span
    className="absolute inset-0 rounded-[50%] border border-composer-accent/20 bg-composer-accent/20 pointer-events-none blur-sm"
    initial={{ scale: 0.8, opacity: 0.5 }}
    animate={{ scale: 2.2, opacity: 0 }}
    transition={{ duration: 0.33, ease: "easeOut" }}
    onAnimationComplete={onComplete}
  />
);

interface SlotProps {
  state: SlotState;
  onCurrentLine: boolean;
  isHeld?: boolean;
  children: React.ReactNode;
}

const Slot: React.FC<SlotProps> = ({ state, onCurrentLine, isHeld = false, children }) => (
  <m.span
    initial={false}
    animate={{ scale: isHeld ? 0.96 : 1 }}
    transition={syncCarouselTransition}
    className={cn(
      "relative inline-flex items-center justify-center origin-center transition-colors duration-150 ease-out",
      state === "untimed"
        ? onCurrentLine
          ? "text-composer-text-secondary"
          : "text-composer-text-faint"
        : SLOT_TEXT_CLASS[state],
    )}
  >
    <span
      aria-hidden
      className={cn(
        "absolute -inset-x-2 -inset-y-1 rounded-lg transition-opacity duration-150 ease-out",
        isHeld ? "bg-composer-accent/25" : "bg-composer-accent/15",
        state === "next" ? "opacity-100" : "opacity-0",
      )}
    />
    {children}
  </m.span>
);

interface WordGranularityLineProps {
  line: SyncCarouselProps["lines"][number];
  idx: number;
  lineIndex: number;
  wordIndex: number;
  isHolding: boolean;
  isCurrent: boolean;
  rippleTarget: RippleTarget | null;
  onRippleComplete: () => void;
}

const WordGranularityLine: React.FC<WordGranularityLineProps> = ({
  line,
  idx,
  lineIndex,
  wordIndex,
  isHolding,
  isCurrent,
  rippleTarget,
  onRippleComplete,
}) => {
  const lineWords = line.displayWordTexts ?? splitIntoWords(line.text);
  return lineWords.map((word, widx) => {
    const isNext = isCurrent && widx === wordIndex;
    const isLastOnCurrent = isCurrent && wordIndex > 0 && widx === wordIndex - 1;
    const isLastOfPrevLine = idx === lineIndex - 1 && wordIndex === 0 && widx === lineWords.length - 1;
    const isLastTapped = !isHolding && (isLastOnCurrent || isLastOfPrevLine);
    const state: SlotState = isNext
      ? "next"
      : isLastTapped
        ? "lastTapped"
        : widx < line.timedWords
          ? "timed"
          : "untimed";

    const hasRipple = rippleTarget !== null && rippleTarget.lineId === line.id && rippleTarget.wordIndex === widx;

    return (
      <Slot key={`${line.id}-${widx}`} state={state} onCurrentLine={isCurrent} isHeld={isHolding && isNext}>
        <span className="relative">{word}</span>
        <AnimatePresence>
          {hasRipple && rippleTarget && <RippleRing key={rippleTarget.nonce} onComplete={onRippleComplete} />}
        </AnimatePresence>
      </Slot>
    );
  });
};

const SharedTagSlot: React.FC<{ tag: SharedSyncTag | undefined }> = ({ tag }) => (
  <span className="flex items-center h-4.5 select-none">
    {tag && (
      <span
        className="inline-flex items-center gap-1 h-4.5 pl-1.5 pr-2 rounded-full text-[11px]"
        style={{ color: tag.color, background: `color-mix(in srgb, ${tag.color} 16%, transparent)` }}
      >
        <IconLink className="size-2.5" />
        <span className="max-w-32 truncate">{tag.label}</span>
      </span>
    )}
  </span>
);

const SyncCarousel: React.FC<SyncCarouselProps> = ({
  lines,
  lineIndex,
  wordIndex,
  granularity,
  isHolding = false,
  rippleTarget = null,
  onRippleComplete,
  aboveCurrent,
}) => {
  const containerHeight = LINE_HEIGHT * 3;
  const translateY = LINE_HEIGHT - lineIndex * LINE_HEIGHT;

  const handleRippleComplete = onRippleComplete ?? noop;

  return (
    <div className="relative overflow-hidden" style={{ height: containerHeight }}>
      <m.div
        initial={{ y: translateY }}
        animate={{ y: translateY }}
        transition={syncCarouselTransition}
        className="flex flex-col items-center"
      >
        {lines.map((line, idx) => {
          const isCurrent = idx === lineIndex;
          const distance = Math.abs(idx - lineIndex);
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.4 : 0;
          const scale = distance === 0 ? 1 : 0.65;

          return (
            <m.div
              key={line.id}
              initial={{ opacity, scale }}
              animate={{ opacity, scale }}
              transition={syncCarouselTransition}
              style={{ height: LINE_HEIGHT }}
              className="flex flex-col items-center justify-center gap-1 w-full shrink-0"
            >
              <span className="relative flex justify-center">
                {isCurrent && aboveCurrent && (
                  <span className="absolute bottom-full flex justify-center pb-2">{aboveCurrent}</span>
                )}
                <SharedTagSlot tag={line.sharedTag?.placement === "above" ? line.sharedTag : undefined} />
              </span>
              <div className="flex flex-wrap items-center justify-center text-4xl font-semibold tracking-[-0.012em] leading-[1.1] gap-x-4 gap-y-1.5">
                {granularity === "line" ? (
                  <Slot
                    state={
                      isCurrent ? "next" : idx === lineIndex - 1 ? "lastTapped" : line.isTimed ? "timed" : "untimed"
                    }
                    onCurrentLine={isCurrent}
                  >
                    <span className="relative">{stripSplitCharacter(line.displayText ?? line.text)}</span>
                  </Slot>
                ) : (
                  <WordGranularityLine
                    line={line}
                    idx={idx}
                    lineIndex={lineIndex}
                    wordIndex={wordIndex}
                    isHolding={isHolding}
                    isCurrent={isCurrent}
                    rippleTarget={rippleTarget}
                    onRippleComplete={handleRippleComplete}
                  />
                )}
              </div>
              <SharedTagSlot tag={line.sharedTag?.placement === "below" ? line.sharedTag : undefined} />
            </m.div>
          );
        })}
      </m.div>
    </div>
  );
};

const noop = () => {};

// -- Exports ------------------------------------------------------------------

export type { RippleTarget };
export { SyncCarousel };
