import type { WordTiming } from "@/stores/project";
import { syncCarouselTransition } from "@/utils/animationVariants";
import { splitIntoWords, stripPipes } from "@/utils/sync-helpers";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// -- Constants ----------------------------------------------------------------

const LINE_HEIGHT = 100;

// -- Interfaces ---------------------------------------------------------------

interface SyncCarouselProps {
  lines: Array<{
    id: string;
    text: string;
    words?: WordTiming[];
    begin?: number;
  }>;
  lineIndex: number;
  wordIndex: number;
  granularity: "line" | "word";
  syncMethod?: "tap" | "hold";
  isHolding?: boolean;
}

// -- Components ---------------------------------------------------------------

const RippleRing: React.FC<{ onComplete: () => void }> = ({ onComplete }) => (
  <motion.span
    className="absolute inset-0 rounded-[50%] border border-composer-accent/20 bg-composer-accent/20 pointer-events-none blur-sm"
    initial={{ scale: 0.8, opacity: 0.5 }}
    animate={{ scale: 2.2, opacity: 0 }}
    transition={{ duration: 0.33, ease: "easeOut" }}
    onAnimationComplete={onComplete}
  />
);

interface WordGranularityLineProps {
  line: SyncCarouselProps["lines"][number];
  idx: number;
  lineIndex: number;
  wordIndex: number;
  syncMethod: "tap" | "hold";
  isHolding: boolean;
  isCurrent: boolean;
  rippleKey: string | null;
  rippleCounter: number;
  setRippleKey: (key: string | null) => void;
}

const WordGranularityLine: React.FC<WordGranularityLineProps> = ({
  line,
  idx,
  lineIndex,
  wordIndex,
  syncMethod,
  isHolding,
  isCurrent,
  rippleKey,
  rippleCounter,
  setRippleKey,
}) => {
  const lineWords = splitIntoWords(line.text);
  return lineWords.map((word, widx) => {
    const isPrevLine = idx === lineIndex - 1;
    const holdActive = syncMethod === "hold" && isHolding;
    const isCurrentHeld = holdActive && isCurrent && widx === wordIndex;
    const isLastSyncedOnCurrent =
      !holdActive && isCurrent && wordIndex > 0 && widx === wordIndex - 1;
    const isLastWordOfPrevLine =
      !holdActive &&
      isPrevLine &&
      wordIndex === 0 &&
      widx === lineWords.length - 1;
    const isLastSynced = isLastSyncedOnCurrent || isLastWordOfPrevLine;

    const color = isCurrentHeld
      ? "rgb(129, 140, 248)"
      : isLastSynced
        ? "rgb(129, 140, 248)"
        : isCurrent
          ? "rgba(255, 255, 255, 0.7)"
          : "rgba(255, 255, 255, 0.4)";

    const wordKey = `${line.id}-${widx}`;
    const hasRipple = rippleKey === wordKey;

    return (
      <motion.span
        key={wordKey}
        animate={{ color, scale: isCurrentHeld ? 0.95 : 1 }}
        transition={syncCarouselTransition}
        className="relative inline-flex items-center justify-center origin-center"
      >
        {word}
        <AnimatePresence>
          {hasRipple && (
            <RippleRing
              key={rippleCounter}
              onComplete={() => setRippleKey(null)}
            />
          )}
        </AnimatePresence>
      </motion.span>
    );
  });
};

const SyncCarousel: React.FC<SyncCarouselProps> = ({
  lines,
  lineIndex,
  wordIndex,
  granularity,
  syncMethod = "tap",
  isHolding = false,
}) => {
  const [rippleKey, setRippleKey] = useState<string | null>(null);
  const [rippleCounter, setRippleCounter] = useState(0);
  const prevHoldingRef = useRef(isHolding);

  useEffect(() => {
    const wasHolding = prevHoldingRef.current;
    prevHoldingRef.current = isHolding;

    if (syncMethod !== "hold" || !wasHolding || isHolding) return;

    const prevWordIndex = wordIndex - 1;
    if (prevWordIndex >= 0) {
      setRippleKey(`${lines[lineIndex]?.id}-${prevWordIndex}`);
    } else if (lineIndex > 0) {
      const prevLine = lines[lineIndex - 1];
      const prevLineWords = splitIntoWords(prevLine.text);
      setRippleKey(`${prevLine.id}-${prevLineWords.length - 1}`);
    }
    setRippleCounter((c) => c + 1);
  }, [isHolding, syncMethod, lineIndex, wordIndex, lines]);

  // Container height shows 3 lines (prev, current, next)
  const containerHeight = LINE_HEIGHT * 3;
  // Offset to center the current line in the middle slot
  const translateY = LINE_HEIGHT - lineIndex * LINE_HEIGHT;

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: containerHeight }}
    >
      <motion.div
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
            <motion.div
              key={line.id}
              initial={{ opacity, scale }}
              animate={{ opacity, scale }}
              transition={syncCarouselTransition}
              style={{ height: LINE_HEIGHT }}
              className="flex items-center justify-center w-full shrink-0"
            >
              <div className="flex flex-wrap items-center justify-center text-4xl font-medium gap-x-4 gap-y-3">
                {granularity === "line" ? (
                  <motion.span
                    animate={{
                      color:
                        idx === lineIndex - 1
                          ? "rgb(129, 140, 248)"
                          : isCurrent
                            ? "rgba(255, 255, 255, 0.7)"
                            : "rgba(255, 255, 255, 0.4)",
                    }}
                    transition={syncCarouselTransition}
                  >
                    {stripPipes(line.text)}
                  </motion.span>
                ) : (
                  <WordGranularityLine
                    line={line}
                    idx={idx}
                    lineIndex={lineIndex}
                    wordIndex={wordIndex}
                    syncMethod={syncMethod}
                    isHolding={isHolding}
                    isCurrent={isCurrent}
                    rippleKey={rippleKey}
                    rippleCounter={rippleCounter}
                    setRippleKey={setRippleKey}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LINE_HEIGHT, SyncCarousel };
