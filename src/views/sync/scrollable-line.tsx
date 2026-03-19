import { getAgentColor, type WordTiming } from "@/stores/project";
import { splitIntoWords, stripPipes } from "@/utils/sync-helpers";
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
  onSplitWord?: (wordIndex: number, newWords: WordTiming[]) => void;
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
    const displayText = stripPipes(text);
    if (editMode && lineBegin !== undefined && lineEnd !== undefined) {
      return (
        <span className="relative inline-block">
          <span className="text-composer-text-muted">{displayText}</span>
          <span
            className="absolute inset-0 overflow-hidden text-composer-accent-text"
            data-word-begin={lineBegin}
            data-word-end={lineEnd}
            style={{ width: "0%" }}
          >
            {displayText}
          </span>
        </span>
      );
    }
    return (
      <span className={lineBegin !== undefined ? "text-composer-text-muted" : "text-composer-text"}>
        {displayText}
      </span>
    );
  };

  const mainWordHandlers: WordHandlers = {
    onNudge: onNudgeWord,
    onSetTime: onSetWordTime,
    onNudgeEnd: onNudgeWordEnd,
    onSetEndTime: onSetWordEndTime,
    onSplit: onSplitWord,
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
      onClick={onClick}
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
  return (
    prev.text === next.text &&
    prev.lineNumber === next.lineNumber &&
    prev.isCurrent === next.isCurrent &&
    prev.agentId === next.agentId &&
    prev.backgroundText === next.backgroundText &&
    prev.backgroundWords === next.backgroundWords &&
    prev.granularity === next.granularity &&
    prev.editMode === next.editMode &&
    prev.lineBegin === next.lineBegin &&
    prev.lineEnd === next.lineEnd &&
    prev.words === next.words
  );
});

// -- Exports ------------------------------------------------------------------

export { ScrollableLine };
