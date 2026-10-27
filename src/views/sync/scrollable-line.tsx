import { getAgentColor } from "@/domain/agent/colors";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { useSettingsStore } from "@/stores/settings";
import { stripSplitCharacter } from "@/utils/split-character";
import { splitIntoWords } from "@/utils/sync-helpers";
import { SyllableGroup } from "@/views/sync/syllable-group";
import { TimeNudgeInput } from "@/views/sync/time-nudge-input";
import { type WordHandlers, WordRenderer } from "@/views/sync/word-renderer";
import { IconLink } from "@tabler/icons-react";
import { memo, useEffect, useMemo, useRef } from "react";
import { cn } from "@/utils/cn";

// -- Interfaces ---------------------------------------------------------------

interface ScrollableLineLinkInfo {
  color: string;
  label: string;
  ordinal: number;
  totalInstances: number;
  shared?: boolean;
}

interface ScrollableLineProps {
  lineId: string;
  text: string;
  displayText?: string;
  displayWordTexts?: string[];
  lineNumber: number;
  isCurrent: boolean;
  agentId?: string;
  backgroundText?: string;
  displayBackgroundText?: string;
  displayBackgroundWordTexts?: string[];
  backgroundWords?: WordTiming[];
  words?: WordTiming[];
  lineBegin?: number;
  lineEnd?: number;
  lineSynced?: boolean;
  granularity: "line" | "word";
  currentTime: number;
  editMode: boolean;
  linkInfo?: ScrollableLineLinkInfo;
  onClick: () => void;
  onClickWord?: (wordIndex: number) => void;
  onClickBgWord?: (wordIndex: number) => void;
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
  lineId,
  text,
  displayText,
  displayWordTexts,
  lineNumber,
  isCurrent,
  agentId,
  backgroundText,
  displayBackgroundText,
  displayBackgroundWordTexts,
  backgroundWords,
  words,
  lineBegin,
  lineEnd,
  lineSynced,
  granularity,
  currentTime,
  editMode,
  linkInfo,
  onClick,
  onClickWord,
  onClickBgWord,
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
  const wordTexts = useMemo(
    () => displayWordTexts ?? (words?.length ? words.map((w) => w.text) : splitIntoWords(text)),
    [displayWordTexts, text, words],
  );
  const bgWordTexts = useMemo(
    () =>
      displayBackgroundWordTexts ??
      (backgroundWords?.length
        ? backgroundWords.map((w) => w.text)
        : (displayBackgroundText ?? backgroundText)
          ? splitIntoWords(displayBackgroundText ?? backgroundText ?? "")
          : []),
    [backgroundText, backgroundWords, displayBackgroundText, displayBackgroundWordTexts],
  );

  useEffect(() => {
    if (isCurrent && lineRef.current) {
      lineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isCurrent]);

  const renderLineContent = () => {
    const renderedText = stripSplitCharacter(displayText ?? text);
    if (editMode && lineBegin !== undefined && lineEnd !== undefined) {
      return (
        <span className="relative inline-block">
          <span className="text-(--muted)">{renderedText}</span>
          <span
            className="absolute inset-0 overflow-hidden text-composer-accent-text"
            data-word-begin={lineBegin}
            data-word-end={lineEnd}
            style={{ width: "0%" }}
          >
            {renderedText}
          </span>
        </span>
      );
    }
    return <span className={lineBegin !== undefined ? "text-(--muted)" : "text-composer-text"}>{renderedText}</span>;
  };

  const showSyllableIndicators = useSettingsStore((s) => s.showSyllableIndicators);

  const mainSyllableGroups = useMemo(
    () => (showSyllableIndicators && words?.length ? computeSyllableGroups(words) : []),
    [words, showSyllableIndicators],
  );

  const bgSyllableGroups = useMemo(
    () => (showSyllableIndicators && backgroundWords?.length ? computeSyllableGroups(backgroundWords) : []),
    [backgroundWords, showSyllableIndicators],
  );

  const mainWordHandlers: WordHandlers = {
    onNudge: onNudgeWord,
    onSetTime: onSetWordTime,
    onNudgeEnd: onNudgeWordEnd,
    onSetEndTime: onSetWordEndTime,
    onSplit: onSplitWord,
    onClickWord,
  };

  const bgWordHandlers: WordHandlers = {
    onNudge: onNudgeBgWord,
    onSetTime: onSetBgWordTime,
    onNudgeEnd: onNudgeBgWordEnd,
    onSetEndTime: onSetBgWordEndTime,
    onClickWord: onClickBgWord,
  };

  const renderWordList = (
    texts: string[],
    timings: WordTiming[] | undefined,
    handlers: WordHandlers,
    groups: ReturnType<typeof computeSyllableGroups>,
    prefix: string,
    isBackground?: boolean,
  ) => {
    if (groups.length === 0) {
      return texts.map((word, idx) => (
        <WordRenderer
          key={`${lineNumber}-${prefix}-${idx}`}
          lineId={lineId}
          word={word}
          idx={idx}
          timing={timings?.[idx]}
          allWords={timings}
          handlers={handlers}
          isBackground={isBackground}
          editMode={editMode}
          currentTime={currentTime}
        />
      ));
    }

    const groupByStart = new Map(groups.map((g) => [g.startIndex, g]));
    const inGroup = new Set(
      groups.flatMap((g) => Array.from({ length: g.endIndex - g.startIndex + 1 }, (_, i) => g.startIndex + i)),
    );
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < texts.length) {
      const group = groupByStart.get(i);
      if (group) {
        const label = displayWordTexts
          ? texts
              .slice(group.startIndex, group.endIndex + 1)
              .map((word) => word.trim())
              .join("-")
          : group.originalWord;
        elements.push(
          <SyllableGroup key={`${lineNumber}-${prefix}-group-${group.startIndex}`} label={label}>
            {texts.slice(group.startIndex, group.endIndex + 1).map((word, j) => {
              const idx = group.startIndex + j;
              return (
                <WordRenderer
                  key={`${lineNumber}-${prefix}-${idx}`}
                  lineId={lineId}
                  word={word}
                  idx={idx}
                  timing={timings?.[idx]}
                  allWords={timings}
                  handlers={handlers}
                  isBackground={isBackground}
                  editMode={editMode}
                  currentTime={currentTime}
                />
              );
            })}
          </SyllableGroup>,
        );
        i = group.endIndex + 1;
      } else if (!inGroup.has(i)) {
        elements.push(
          <WordRenderer
            key={`${lineNumber}-${prefix}-${i}`}
            lineId={lineId}
            word={texts[i]}
            idx={i}
            timing={timings?.[i]}
            allWords={timings}
            handlers={handlers}
            isBackground={isBackground}
            editMode={editMode}
            currentTime={currentTime}
          />,
        );
        i++;
      } else {
        i++;
      }
    }

    return elements;
  };

  return (
    <div
      ref={lineRef}
      role="button"
      tabIndex={-1}
      aria-current={isCurrent || undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      className={cn("group/row flex w-full text-left cursor-pointer", isCurrent && "bg-composer-accent/7")}
    >
      <span
        className="line-cell flex justify-center w-12 shrink-0 h-auto"
        style={{ "--agent": getAgentColor(agentId ?? "") }}
        title={agentId}
      >
        <span
          className={cn(
            "grid place-items-center h-10 font-mono font-medium text-xs tabular-nums",
            isCurrent ? "font-semibold text-composer-text" : "text-(--muted)",
          )}
        >
          {lineNumber}
        </span>
      </span>
      <span className="flex flex-1 min-w-0 items-start gap-4 pt-2.5 pb-3 px-5 border-b border-(--divider) transition-colors group-hover/row:bg-(--layer-1)">
        <div className="flex flex-col flex-1 min-w-0 gap-2 text-[17px] font-medium leading-6">
          {granularity === "line" || lineSynced ? (
            <div className="flex items-center justify-between gap-3">
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
            <div className="flex flex-wrap gap-x-3.5 gap-y-2 items-end">
              {renderWordList(wordTexts, words, mainWordHandlers, mainSyllableGroups, "main")}
            </div>
          )}
          {bgWordTexts.length > 0 && (
            <div className="flex flex-wrap gap-x-3.5 gap-y-2 items-end">
              {renderWordList(bgWordTexts, backgroundWords, bgWordHandlers, bgSyllableGroups, "bg", true)}
            </div>
          )}
        </div>
        {linkInfo && (
          <span
            className="flex shrink-0 items-center gap-[5px] h-5 mt-[3px] pl-1.5 pr-2 rounded-md text-[11.5px] font-semibold tabular-nums whitespace-nowrap select-none"
            title={`Linked: ${linkInfo.label} ${linkInfo.ordinal}/${linkInfo.totalInstances}`}
            style={{ background: `color-mix(in oklab, ${linkInfo.color} 18%, transparent)`, color: linkInfo.color }}
          >
            <IconLink className="size-3" />
            <span className="max-w-32 truncate">{linkInfo.label}</span>
            <span className="font-medium opacity-75">
              {linkInfo.shared ? "Shared" : `${linkInfo.ordinal}/${linkInfo.totalInstances}`}
            </span>
          </span>
        )}
      </span>
    </div>
  );
};

const ScrollableLine = memo(ScrollableLineInner, (prev, next) => {
  return (
    prev.text === next.text &&
    prev.displayText === next.displayText &&
    prev.displayWordTexts === next.displayWordTexts &&
    prev.lineNumber === next.lineNumber &&
    prev.isCurrent === next.isCurrent &&
    prev.agentId === next.agentId &&
    prev.backgroundText === next.backgroundText &&
    prev.displayBackgroundText === next.displayBackgroundText &&
    prev.displayBackgroundWordTexts === next.displayBackgroundWordTexts &&
    prev.backgroundWords === next.backgroundWords &&
    prev.granularity === next.granularity &&
    prev.editMode === next.editMode &&
    prev.lineBegin === next.lineBegin &&
    prev.lineEnd === next.lineEnd &&
    prev.lineSynced === next.lineSynced &&
    prev.words === next.words &&
    prev.linkInfo?.color === next.linkInfo?.color &&
    prev.linkInfo?.label === next.linkInfo?.label &&
    prev.linkInfo?.ordinal === next.linkInfo?.ordinal &&
    prev.linkInfo?.totalInstances === next.linkInfo?.totalInstances &&
    prev.linkInfo?.shared === next.linkInfo?.shared
  );
});

// -- Exports ------------------------------------------------------------------

export { ScrollableLine };
export type { ScrollableLineLinkInfo };
