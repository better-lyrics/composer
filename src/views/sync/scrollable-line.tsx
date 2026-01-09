import { getAgentColor, type SyllableTiming, type WordTiming } from "@/stores/project";
import { Tooltip } from "@/ui/tooltip";
import { splitIntoWords } from "@/utils/sync-helpers";
import { SyllableSplitter } from "@/views/sync/syllable-splitter";
import { TimeNudgeInput } from "@/views/sync/time-nudge-input";
import { IconAlertTriangle, IconArrowRight } from "@tabler/icons-react";
import { memo, useEffect, useMemo, useRef } from "react";

// -- Interfaces ---------------------------------------------------------------

interface ScrollableLineProps {
  text: string;
  lineNumber: number;
  isCurrent: boolean;
  agentId?: string;
  backgroundText?: string;
  backgroundWords?: WordTiming[];
  words?: WordTiming[];
  lineBegin?: number;
  lineEnd?: number;
  granularity: "line" | "word";
  currentTime: number;
  editMode: boolean;
  onClick: () => void;
  onNudgeWord?: (wordIndex: number, delta: number) => void;
  onSetWordTime?: (wordIndex: number, newBegin: number) => void;
  onNudgeWordEnd?: (wordIndex: number, delta: number) => void;
  onSetWordEndTime?: (wordIndex: number, newEnd: number) => void;
  onNudgeLine?: (delta: number) => void;
  onSetLineTime?: (newBegin: number) => void;
  onSplitWord?: (wordIndex: number, syllables: SyllableTiming[]) => void;
  onNudgeSyllable?: (wordIndex: number, syllableIdx: number, delta: number) => void;
  onSetSyllableTime?: (wordIndex: number, syllableIdx: number, newBegin: number) => void;
  onNudgeSyllableEnd?: (wordIndex: number, syllableIdx: number, delta: number) => void;
  onSetSyllableEndTime?: (wordIndex: number, syllableIdx: number, newEnd: number) => void;
  onNudgeBgWord?: (wordIndex: number, delta: number) => void;
  onSetBgWordTime?: (wordIndex: number, newBegin: number) => void;
  onNudgeBgWordEnd?: (wordIndex: number, delta: number) => void;
  onSetBgWordEndTime?: (wordIndex: number, newEnd: number) => void;
}

// -- Components ---------------------------------------------------------------

const ScrollableLineInner: React.FC<ScrollableLineProps> = ({
  text,
  lineNumber,
  isCurrent,
  agentId,
  backgroundText,
  backgroundWords,
  words,
  lineBegin,
  lineEnd,
  granularity,
  currentTime,
  editMode,
  onClick,
  onNudgeWord,
  onSetWordTime,
  onNudgeWordEnd,
  onSetWordEndTime,
  onNudgeLine,
  onSetLineTime,
  onSplitWord,
  onNudgeSyllable,
  onSetSyllableTime,
  onNudgeSyllableEnd,
  onSetSyllableEndTime,
  onNudgeBgWord,
  onSetBgWordTime,
  onNudgeBgWordEnd,
  onSetBgWordEndTime,
}) => {
  const lineRef = useRef<HTMLDivElement>(null);
  const wordTexts = useMemo(() => splitIntoWords(text), [text]);
  const bgWordTexts = useMemo(() => (backgroundText ? splitIntoWords(backgroundText) : []), [backgroundText]);

  useEffect(() => {
    if (isCurrent && lineRef.current) {
      lineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isCurrent]);

  const renderLineContent = () => {
    if (editMode && lineBegin !== undefined && lineEnd !== undefined) {
      const isOpen = lineEnd === lineBegin;
      const isActive = currentTime >= lineBegin && (isOpen || currentTime < lineEnd);
      const isCompleted = lineEnd > lineBegin && currentTime >= lineEnd;
      const duration = lineEnd - lineBegin;
      const progress = isActive ? (duration > 0 ? (currentTime - lineBegin) / duration : 0) : isCompleted ? 1 : 0;
      return (
        <span className="relative inline-block">
          <span className="text-composer-text-muted">{text}</span>
          <span
            className="absolute inset-0 overflow-hidden text-composer-accent-text"
            style={{ width: `${progress * 100}%` }}
          >
            {text}
          </span>
        </span>
      );
    }
    return <span className={lineBegin !== undefined ? "text-composer-text-muted" : "text-composer-text"}>{text}</span>;
  };

  const renderWordContent = (word: string, timing: WordTiming | undefined, isBackground = false) => {
    const isSynced = !!timing;
    const baseClass = isBackground ? "italic" : "";
    const syncedClass = isBackground ? "text-composer-text-muted/70" : "text-composer-text-muted";
    const unsyncedClass = isBackground ? "text-composer-text-muted/50" : "text-composer-text";
    const activeClass = isBackground ? "text-composer-accent-text/80" : "text-composer-accent-text";

    if (editMode && isSynced) {
      const isOpen = timing.end === timing.begin;
      const isWordActive = currentTime >= timing.begin && (isOpen || currentTime < timing.end);
      const isWordCompleted = timing.end > timing.begin && currentTime >= timing.end;
      const duration = timing.end - timing.begin;
      const wordProgress = isWordActive
        ? duration > 0
          ? (currentTime - timing.begin) / duration
          : 0
        : isWordCompleted
          ? 1
          : 0;
      return (
        <span className={`relative inline-block ${baseClass}`}>
          <span className={syncedClass}>{word}</span>
          <span
            className={`absolute inset-0 overflow-hidden ${activeClass}`}
            style={{ width: `${wordProgress * 100}%` }}
          >
            {word}
          </span>
        </span>
      );
    }
    return <span className={`${baseClass} ${isSynced ? syncedClass : unsyncedClass}`}>{word}</span>;
  };

  const renderWord = (
    word: string,
    idx: number,
    timing: WordTiming | undefined,
    allWords: WordTiming[] | undefined,
    handlers: {
      onNudge?: (idx: number, delta: number) => void;
      onSetTime?: (idx: number, newBegin: number) => void;
      onNudgeEnd?: (idx: number, delta: number) => void;
      onSetEndTime?: (idx: number, newEnd: number) => void;
      onSplit?: (idx: number, syllables: SyllableTiming[]) => void;
      onNudgeSyllable?: (idx: number, syllableIdx: number, delta: number) => void;
      onSetSyllableTime?: (idx: number, syllableIdx: number, newBegin: number) => void;
      onNudgeSyllableEnd?: (idx: number, syllableIdx: number, delta: number) => void;
      onSetSyllableEndTime?: (idx: number, syllableIdx: number, newEnd: number) => void;
    },
    isBackground = false,
  ) => {
    const isSynced = !!timing;
    const hasSyllables = !!timing?.syllables?.length;

    const prevWord = allWords?.[idx - 1];
    const nextWord = allWords?.[idx + 1];
    const minBegin = prevWord?.end ?? 0;
    const maxBegin = timing?.end ?? 0;
    const minEnd = timing?.begin ?? 0;
    const maxEnd = nextWord?.begin ?? Number.POSITIVE_INFINITY;

    return (
      <span
        key={`${lineNumber}-${isBackground ? "bg" : "main"}-${word}-${idx}`}
        className={`inline-flex flex-col items-start ${isBackground ? "italic" : ""}`}
      >
        {hasSyllables && !isBackground ? (
          <SyllableSplitter
            word={timing}
            currentTime={currentTime}
            onSplit={(syllables) => handlers.onSplit?.(idx, syllables)}
            onNudgeSyllable={(syllableIdx, delta) => handlers.onNudgeSyllable?.(idx, syllableIdx, delta)}
            onSetSyllableTime={(syllableIdx, newBegin) => handlers.onSetSyllableTime?.(idx, syllableIdx, newBegin)}
            onNudgeSyllableEnd={(syllableIdx, delta) => handlers.onNudgeSyllableEnd?.(idx, syllableIdx, delta)}
            onSetSyllableEndTime={(syllableIdx, newEnd) => handlers.onSetSyllableEndTime?.(idx, syllableIdx, newEnd)}
          />
        ) : (
          <>
            <span className="flex items-center gap-1 group/word">
              {renderWordContent(word, timing, isBackground)}
              {isSynced && timing && timing.end === timing.begin && (
                <Tooltip content="No duration - sync the next word to close this one or increase the end time">
                  <span className="text-composer-warning">
                    <IconAlertTriangle className="w-3.5 h-3.5" />
                  </span>
                </Tooltip>
              )}
              {isSynced && timing && timing.text.length >= 2 && !isBackground && (
                <span className="transition-opacity opacity-0 group-hover/word:opacity-100">
                  <SyllableSplitter
                    word={timing}
                    currentTime={currentTime}
                    onSplit={(syllables) => handlers.onSplit?.(idx, syllables)}
                    onNudgeSyllable={(syllableIdx, delta) => handlers.onNudgeSyllable?.(idx, syllableIdx, delta)}
                    onSetSyllableTime={(syllableIdx, newBegin) =>
                      handlers.onSetSyllableTime?.(idx, syllableIdx, newBegin)
                    }
                    onNudgeSyllableEnd={(syllableIdx, delta) => handlers.onNudgeSyllableEnd?.(idx, syllableIdx, delta)}
                    onSetSyllableEndTime={(syllableIdx, newEnd) =>
                      handlers.onSetSyllableEndTime?.(idx, syllableIdx, newEnd)
                    }
                  />
                </span>
              )}
            </span>
            {isSynced && timing && (
              <span className="flex items-center gap-1">
                <TimeNudgeInput
                  value={timing.begin}
                  currentTime={currentTime}
                  canDecrease={timing.begin > minBegin}
                  canIncrease={timing.begin < maxBegin}
                  onNudge={(delta) => handlers.onNudge?.(idx, delta)}
                  onSetTime={(newBegin) => handlers.onSetTime?.(idx, newBegin)}
                />
                <IconArrowRight className="w-2.5 h-2.5 text-composer-text opacity-25 mx-0.5" />
                <TimeNudgeInput
                  value={timing.end}
                  currentTime={currentTime}
                  canDecrease={timing.end > minEnd}
                  canIncrease={timing.end < maxEnd}
                  onNudge={(delta) => handlers.onNudgeEnd?.(idx, delta)}
                  onSetTime={(newEnd) => handlers.onSetEndTime?.(idx, newEnd)}
                />
              </span>
            )}
          </>
        )}
      </span>
    );
  };

  return (
    <div
      ref={lineRef}
      // biome-ignore lint/a11y/useSemanticElements: contains nested buttons for nudge controls
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`flex items-start gap-3 px-4 py-2 w-full text-left cursor-pointer transition-colors hover:bg-composer-button/50 border-l-2 ${
        isCurrent ? "bg-composer-accent/10 border-composer-accent" : "border-transparent"
      }`}
    >
      <span className="flex items-center gap-1.5 mt-1 w-10 shrink-0">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: agentId ? getAgentColor(agentId) : "transparent",
          }}
          title={agentId}
        />
        <span className="flex-1 font-mono text-xs text-right text-composer-text-muted tabular-nums">{lineNumber}</span>
      </span>
      <div className="flex flex-col flex-1 gap-1">
        {granularity === "line" ? (
          <div className="flex items-start justify-between gap-2">
            {renderLineContent()}
            {lineBegin !== undefined && onNudgeLine && onSetLineTime && (
              <TimeNudgeInput
                value={lineBegin}
                currentTime={currentTime}
                canDecrease
                canIncrease
                onNudge={onNudgeLine}
                onSetTime={onSetLineTime}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {wordTexts.map((word, idx) =>
              renderWord(word, idx, words?.[idx], words, {
                onNudge: onNudgeWord,
                onSetTime: onSetWordTime,
                onNudgeEnd: onNudgeWordEnd,
                onSetEndTime: onSetWordEndTime,
                onSplit: onSplitWord,
                onNudgeSyllable: onNudgeSyllable,
                onSetSyllableTime: onSetSyllableTime,
                onNudgeSyllableEnd: onNudgeSyllableEnd,
                onSetSyllableEndTime: onSetSyllableEndTime,
              }),
            )}
          </div>
        )}
        {backgroundText && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {bgWordTexts.map((word, idx) =>
              renderWord(
                word,
                idx,
                backgroundWords?.[idx],
                backgroundWords,
                {
                  onNudge: onNudgeBgWord,
                  onSetTime: onSetBgWordTime,
                  onNudgeEnd: onNudgeBgWordEnd,
                  onSetEndTime: onSetBgWordEndTime,
                },
                true,
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Memoize to prevent re-renders when currentTime changes but line doesn't need update
const ScrollableLine = memo(ScrollableLineInner, (prev, next) => {
  // Always re-render if non-time props change
  if (
    prev.text !== next.text ||
    prev.lineNumber !== next.lineNumber ||
    prev.isCurrent !== next.isCurrent ||
    prev.agentId !== next.agentId ||
    prev.backgroundText !== next.backgroundText ||
    prev.backgroundWords !== next.backgroundWords ||
    prev.granularity !== next.granularity ||
    prev.editMode !== next.editMode ||
    prev.lineBegin !== next.lineBegin ||
    prev.lineEnd !== next.lineEnd ||
    prev.words !== next.words
  ) {
    return false;
  }

  // In edit mode with timing, we need currentTime for progress bar
  if (next.editMode && (next.lineBegin !== undefined || next.words?.length || next.backgroundWords?.length)) {
    return false;
  }

  // Otherwise, currentTime changes don't matter
  return true;
});

// -- Exports ------------------------------------------------------------------

export { ScrollableLine };
