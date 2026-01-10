import type { SyllableTiming, WordTiming } from "@/stores/project";
import { Tooltip } from "@/ui/tooltip";
import { SyllableSplitter } from "@/views/sync/syllable-splitter";
import { TimeNudgeInput } from "@/views/sync/time-nudge-input";
import { IconAlertTriangle, IconArrowRight } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface WordHandlers {
  onNudge?: (idx: number, delta: number) => void;
  onSetTime?: (idx: number, newBegin: number) => void;
  onNudgeEnd?: (idx: number, delta: number) => void;
  onSetEndTime?: (idx: number, newEnd: number) => void;
  onSplit?: (idx: number, syllables: SyllableTiming[]) => void;
  onNudgeSyllable?: (idx: number, syllableIdx: number, delta: number) => void;
  onSetSyllableTime?: (idx: number, syllableIdx: number, newBegin: number) => void;
  onNudgeSyllableEnd?: (idx: number, syllableIdx: number, delta: number) => void;
  onSetSyllableEndTime?: (idx: number, syllableIdx: number, newEnd: number) => void;
}

interface WordRendererProps {
  word: string;
  idx: number;
  lineNumber: number;
  timing: WordTiming | undefined;
  allWords: WordTiming[] | undefined;
  handlers: WordHandlers;
  isBackground?: boolean;
  editMode: boolean;
  currentTime: number;
}

// -- Helper -------------------------------------------------------------------

function renderWordContent(
  word: string,
  timing: WordTiming | undefined,
  isBackground: boolean,
  editMode: boolean,
  currentTime: number,
) {
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
        <span className={`absolute inset-0 overflow-hidden ${activeClass}`} style={{ width: `${wordProgress * 100}%` }}>
          {word}
        </span>
      </span>
    );
  }
  return <span className={`${baseClass} ${isSynced ? syncedClass : unsyncedClass}`}>{word}</span>;
}

// -- Component ----------------------------------------------------------------

const WordRenderer: React.FC<WordRendererProps> = ({
  word,
  idx,
  lineNumber,
  timing,
  allWords,
  handlers,
  isBackground = false,
  editMode,
  currentTime,
}) => {
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
            {renderWordContent(word, timing, isBackground, editMode, currentTime)}
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

// -- Exports ------------------------------------------------------------------

export { WordRenderer };
export type { WordHandlers };
