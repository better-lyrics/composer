import type { WordTiming } from "@/domain/word/timing";
import { syncCarouselTransition } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { stripSplitCharacter } from "@/utils/split-character";
import { splitIntoWords } from "@/utils/sync-helpers";
import { AnimatePresence, m } from "motion/react";

// -- Constants ----------------------------------------------------------------

const LINE_HEIGHT = 100;

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
    words?: WordTiming[];
    isTimed: boolean;
  }>;
  lineIndex: number;
  wordIndex: number;
  granularity: "line" | "word";
  isHolding?: boolean;
  rippleTarget?: RippleTarget | null;
  onRippleComplete?: () => void;
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

interface WordGranularityLineProps {
  line: SyncCarouselProps["lines"][number];
  wordIndex: number;
  isHolding: boolean;
  isCurrent: boolean;
  rippleTarget: RippleTarget | null;
  onRippleComplete: () => void;
}

const WordGranularityLine: React.FC<WordGranularityLineProps> = ({
  line,
  wordIndex,
  isHolding,
  isCurrent,
  rippleTarget,
  onRippleComplete,
}) => {
  const lineWords = line.displayWordTexts ?? splitIntoWords(line.text);
  return lineWords.map((word, widx) => {
    const isSelected = isCurrent && widx === wordIndex;
    const isCurrentHeld = isHolding && isSelected;
    const isSynced = !!line.words?.[widx];

    const hasRipple = rippleTarget !== null && rippleTarget.lineId === line.id && rippleTarget.wordIndex === widx;

    return (
      <m.span
        key={`${line.id}-${widx}`}
        aria-current={isSelected ? "step" : undefined}
        animate={{ scale: isCurrentHeld ? 0.95 : 1 }}
        transition={syncCarouselTransition}
        className={cn(
          "relative inline-flex items-center justify-center origin-center rounded-md border border-transparent px-1.5 py-0.5 motion-safe:transition-colors duration-150",
          isSelected
            ? "border-composer-accent/60 bg-composer-accent/10 text-composer-accent-text"
            : isSynced
              ? "text-composer-accent-text underline decoration-composer-accent/40 decoration-2 underline-offset-8"
              : isCurrent
                ? "text-composer-text-secondary"
                : "text-composer-text-disabled",
          isCurrentHeld && "bg-composer-accent/20",
        )}
      >
        {word}
        <AnimatePresence>
          {hasRipple && rippleTarget && <RippleRing key={rippleTarget.nonce} onComplete={onRippleComplete} />}
        </AnimatePresence>
      </m.span>
    );
  });
};

const SyncCarousel: React.FC<SyncCarouselProps> = ({
  lines,
  lineIndex,
  wordIndex,
  granularity,
  isHolding = false,
  rippleTarget = null,
  onRippleComplete,
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
              className="flex items-center justify-center w-full shrink-0"
            >
              <div className="flex flex-wrap items-center justify-center text-4xl font-medium gap-x-1 gap-y-2">
                {granularity === "line" ? (
                  <span
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "rounded-md border border-transparent px-1.5 py-0.5 motion-safe:transition-colors duration-150",
                      isCurrent
                        ? "border-composer-accent/60 bg-composer-accent/10 text-composer-accent-text"
                        : line.isTimed
                          ? "text-composer-accent-text underline decoration-composer-accent/40 decoration-2 underline-offset-8"
                          : "text-composer-text-disabled",
                    )}
                  >
                    {stripSplitCharacter(line.displayText ?? line.text)}
                  </span>
                ) : (
                  <WordGranularityLine
                    line={line}
                    wordIndex={wordIndex}
                    isHolding={isHolding}
                    isCurrent={isCurrent}
                    rippleTarget={rippleTarget}
                    onRippleComplete={handleRippleComplete}
                  />
                )}
              </div>
            </m.div>
          );
        })}
      </m.div>
    </div>
  );
};

const noop = () => {};

// -- Exports ------------------------------------------------------------------

export { SyncCarousel };
export type { RippleTarget };
