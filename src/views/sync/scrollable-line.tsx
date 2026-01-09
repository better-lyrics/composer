import type { SyllableTiming, WordTiming } from "@/stores/project";
import { Tooltip } from "@/ui/tooltip";
import { splitIntoWords } from "@/utils/sync-helpers";
import { SyllableSplitter } from "@/views/sync/syllable-splitter";
import { TimeNudgeInput } from "@/views/sync/time-nudge-input";
import { IconAlertTriangle, IconArrowRight } from "@tabler/icons-react";
import { useEffect, useMemo, useRef } from "react";

// -- Interfaces ---------------------------------------------------------------

interface ScrollableLineProps {
  text: string;
  lineNumber: number;
  isCurrent: boolean;
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
}

// -- Components ---------------------------------------------------------------

const ScrollableLine: React.FC<ScrollableLineProps> = ({
  text,
  lineNumber,
  isCurrent,
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
}) => {
  const lineRef = useRef<HTMLDivElement>(null);
  const wordTexts = useMemo(() => splitIntoWords(text), [text]);

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

  const renderWordContent = (word: string, timing: WordTiming | undefined) => {
    const isSynced = !!timing;

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
        <span className="relative inline-block">
          <span className="text-composer-text-muted">{word}</span>
          <span
            className="absolute inset-0 overflow-hidden text-composer-accent-text"
            style={{ width: `${wordProgress * 100}%` }}
          >
            {word}
          </span>
        </span>
      );
    }
    return <span className={isSynced ? "text-composer-text-muted" : "text-composer-text"}>{word}</span>;
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
      <span className="w-8 mt-1 font-mono text-xs text-right shrink-0 text-composer-text-muted tabular-nums">
        {lineNumber}
      </span>
      {granularity === "line" ? (
        <div className="flex items-start justify-between flex-1 gap-2">
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
        <div className="flex flex-wrap flex-1 gap-x-3 gap-y-1">
          {wordTexts.map((word, idx) => {
            const timing = words?.[idx];
            const isSynced = !!timing;
            const hasSyllables = !!timing?.syllables?.length;

            const prevWord = words?.[idx - 1];
            const nextWord = words?.[idx + 1];
            const minBegin = prevWord?.end ?? 0;
            const maxBegin = timing?.end ?? 0;
            const minEnd = timing?.begin ?? 0;
            const maxEnd = nextWord?.begin ?? Number.POSITIVE_INFINITY;

            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: word order is fixed in lyrics
              <span key={`${lineNumber}-${idx}`} className="inline-flex flex-col items-start">
                {hasSyllables ? (
                  <SyllableSplitter
                    word={timing}
                    currentTime={currentTime}
                    onSplit={(syllables) => onSplitWord?.(idx, syllables)}
                    onNudgeSyllable={(syllableIdx, delta) => onNudgeSyllable?.(idx, syllableIdx, delta)}
                    onSetSyllableTime={(syllableIdx, newBegin) => onSetSyllableTime?.(idx, syllableIdx, newBegin)}
                    onNudgeSyllableEnd={(syllableIdx, delta) => onNudgeSyllableEnd?.(idx, syllableIdx, delta)}
                    onSetSyllableEndTime={(syllableIdx, newEnd) => onSetSyllableEndTime?.(idx, syllableIdx, newEnd)}
                  />
                ) : (
                  <>
                    <span className="flex items-center gap-1 group/word">
                      {renderWordContent(word, timing)}
                      {isSynced && timing && timing.end === timing.begin && (
                        <Tooltip content="No duration - sync the next word to close this one or increase the end time">
                          <span className="text-composer-warning">
                            <IconAlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        </Tooltip>
                      )}
                      {isSynced && timing && (
                        <span className="transition-opacity opacity-0 group-hover/word:opacity-100">
                          <SyllableSplitter
                            word={timing}
                            currentTime={currentTime}
                            onSplit={(syllables) => onSplitWord?.(idx, syllables)}
                            onNudgeSyllable={(syllableIdx, delta) => onNudgeSyllable?.(idx, syllableIdx, delta)}
                            onSetSyllableTime={(syllableIdx, newBegin) =>
                              onSetSyllableTime?.(idx, syllableIdx, newBegin)
                            }
                            onNudgeSyllableEnd={(syllableIdx, delta) => onNudgeSyllableEnd?.(idx, syllableIdx, delta)}
                            onSetSyllableEndTime={(syllableIdx, newEnd) =>
                              onSetSyllableEndTime?.(idx, syllableIdx, newEnd)
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
                          onNudge={(delta) => onNudgeWord?.(idx, delta)}
                          onSetTime={(newBegin) => onSetWordTime?.(idx, newBegin)}
                        />
                        <IconArrowRight className="w-2.5 h-2.5 text-composer-text opacity-25 mx-0.5" />
                        <TimeNudgeInput
                          value={timing.end}
                          currentTime={currentTime}
                          canDecrease={timing.end > minEnd}
                          canIncrease={timing.end < maxEnd}
                          onNudge={(delta) => onNudgeWordEnd?.(idx, delta)}
                          onSetTime={(newEnd) => onSetWordEndTime?.(idx, newEnd)}
                        />
                      </span>
                    )}
                  </>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ScrollableLine };
