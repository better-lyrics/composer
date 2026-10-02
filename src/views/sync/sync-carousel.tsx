import type { WordTiming } from "@/domain/word/timing";
import { useThemeStore } from "@/stores/theme";
import { syncCarouselTransition } from "@/utils/animationVariants";
import { stripSplitCharacter } from "@/utils/split-character";
import { splitIntoWords } from "@/utils/sync-helpers";
import { readToken } from "@/utils/theme/read-token";
import type { SharedSyncTag } from "@/views/sync/shared-sync-tags";
import { IconLink } from "@tabler/icons-react";
import { AnimatePresence, m } from "motion/react";
import { useMemo } from "react";

// -- Hooks --------------------------------------------------------------------

function useCarouselColors(): { accentColor: string; secondaryColor: string; disabledColor: string } {
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeThemeId re-reads the DOM-resolved colors when the theme changes
  return useMemo(
    () => ({
      accentColor: readToken("accent"),
      secondaryColor: readToken("text-secondary"),
      disabledColor: readToken("text-disabled"),
    }),
    // react-doctor-disable-next-line react-doctor/exhaustive-deps -- activeThemeId is the intended cache key: readToken reads DOM CSS vars non-reactively, so the memo must recompute when the theme changes
    [activeThemeId],
  );
}

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
    begin?: number;
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
  const { accentColor, secondaryColor, disabledColor } = useCarouselColors();
  const lineWords = line.displayWordTexts ?? splitIntoWords(line.text);
  return lineWords.map((word, widx) => {
    const isPrevLine = idx === lineIndex - 1;
    const holdActive = isHolding;
    const isCurrentHeld = holdActive && isCurrent && widx === wordIndex;
    const isLastSyncedOnCurrent = !holdActive && isCurrent && wordIndex > 0 && widx === wordIndex - 1;
    const isLastWordOfPrevLine = !holdActive && isPrevLine && wordIndex === 0 && widx === lineWords.length - 1;
    const isLastSynced = isLastSyncedOnCurrent || isLastWordOfPrevLine;

    const color = isCurrentHeld ? accentColor : isLastSynced ? accentColor : isCurrent ? secondaryColor : disabledColor;

    const hasRipple = rippleTarget !== null && rippleTarget.lineId === line.id && rippleTarget.wordIndex === widx;

    return (
      <m.span
        key={`${line.id}-${widx}`}
        initial={false}
        animate={{ color, scale: isCurrentHeld ? 0.95 : 1 }}
        transition={syncCarouselTransition}
        className="relative inline-flex items-center justify-center origin-center"
      >
        {word}
        <AnimatePresence>
          {hasRipple && rippleTarget && <RippleRing key={rippleTarget.nonce} onComplete={onRippleComplete} />}
        </AnimatePresence>
      </m.span>
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
        {tag.label}
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
  const { accentColor, secondaryColor, disabledColor } = useCarouselColors();

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
              <div className="flex flex-wrap items-center justify-center text-4xl font-medium gap-x-4 gap-y-3">
                {granularity === "line" ? (
                  <m.span
                    initial={false}
                    animate={{
                      color: idx === lineIndex - 1 ? accentColor : isCurrent ? secondaryColor : disabledColor,
                    }}
                    transition={syncCarouselTransition}
                  >
                    {stripSplitCharacter(line.displayText ?? line.text)}
                  </m.span>
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

export { SyncCarousel };
export type { RippleTarget };
