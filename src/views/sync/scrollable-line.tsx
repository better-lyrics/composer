import { getAgentColor, type SyllableTiming, type WordTiming } from "@/stores/project";
import { splitIntoWords } from "@/utils/sync-helpers";
import { TimeNudgeInput } from "@/views/sync/time-nudge-input";
import { WordRenderer, type WordHandlers } from "@/views/sync/word-renderer";
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

// -- Component ----------------------------------------------------------------

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
  const wordTexts = useMemo(() => (words?.length ? words.map((w) => w.text) : splitIntoWords(text)), [text, words]);
  const bgWordTexts = useMemo(
    () =>
      backgroundWords?.length
        ? backgroundWords.map((w) => w.text)
        : backgroundText
          ? splitIntoWords(backgroundText)
          : [],
    [backgroundText, backgroundWords],
  );

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

  const mainWordHandlers: WordHandlers = {
    onNudge: onNudgeWord,
    onSetTime: onSetWordTime,
    onNudgeEnd: onNudgeWordEnd,
    onSetEndTime: onSetWordEndTime,
    onSplit: onSplitWord,
    onNudgeSyllable: onNudgeSyllable,
    onSetSyllableTime: onSetSyllableTime,
    onNudgeSyllableEnd: onNudgeSyllableEnd,
    onSetSyllableEndTime: onSetSyllableEndTime,
  };

  const bgWordHandlers: WordHandlers = {
    onNudge: onNudgeBgWord,
    onSetTime: onSetBgWordTime,
    onNudgeEnd: onNudgeBgWordEnd,
    onSetEndTime: onSetBgWordEndTime,
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
      className={`flex items-start gap-3 px-4 py-2 w-full text-left cursor-pointer transition-colors hover:bg-composer-button/50 border-l ${
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
            {wordTexts.map((word, idx) => (
              <WordRenderer
                // biome-ignore lint/suspicious/noArrayIndexKey: index is stable for word position
                key={`${lineNumber}-main-${idx}`}
                word={word}
                idx={idx}
                lineNumber={lineNumber}
                timing={words?.[idx]}
                allWords={words}
                handlers={mainWordHandlers}
                editMode={editMode}
                currentTime={currentTime}
              />
            ))}
          </div>
        )}
        {bgWordTexts.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {bgWordTexts.map((word, idx) => (
              <WordRenderer
                // biome-ignore lint/suspicious/noArrayIndexKey: index is stable for word position
                key={`${lineNumber}-bg-${idx}`}
                word={word}
                idx={idx}
                lineNumber={lineNumber}
                timing={backgroundWords?.[idx]}
                allWords={backgroundWords}
                handlers={bgWordHandlers}
                isBackground
                editMode={editMode}
                currentTime={currentTime}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ScrollableLine = memo(ScrollableLineInner, (prev, next) => {
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

  if (!next.editMode) return true;

  const getTimingBounds = (props: ScrollableLineProps) => {
    if (props.words?.length) {
      return { begin: props.words[0].begin, end: props.words[props.words.length - 1].end };
    }
    if (props.lineBegin !== undefined && props.lineEnd !== undefined) {
      return { begin: props.lineBegin, end: props.lineEnd };
    }
    return null;
  };

  const timing = getTimingBounds(next);
  if (!timing) return true;

  const wasActive = prev.currentTime >= timing.begin && prev.currentTime < timing.end;
  const isActive = next.currentTime >= timing.begin && next.currentTime < timing.end;
  const wasComplete = prev.currentTime >= timing.end;
  const isComplete = next.currentTime >= timing.end;

  if (wasActive !== isActive || wasComplete !== isComplete) return false;
  if (isActive) return false;

  return true;
});

// -- Exports ------------------------------------------------------------------

export { ScrollableLine };
