import type { WordTiming } from "@/domain/word/timing";
import type { useSyncHandlers } from "@/hooks/useSyncHandlers";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

type SyncLineListHandlers = Pick<
  ReturnType<typeof useSyncHandlers>,
  | "handleJumpToLine"
  | "handleJumpToWord"
  | "handleJumpToBgWord"
  | "handleNudgeWord"
  | "handleSetWordTime"
  | "handleNudgeWordEnd"
  | "handleSetWordEndTime"
  | "handleNudgeLine"
  | "handleSetLineTime"
  | "handleSplitWord"
  | "handleNudgeBgWord"
  | "handleSetBgWordTime"
  | "handleNudgeBgWordEnd"
  | "handleSetBgWordEndTime"
>;

interface RowCallbacks {
  onClick: () => void;
  onClickWord: (wordIdx: number) => void;
  onClickBgWord: (wordIdx: number) => void;
  onNudgeWord: (wordIdx: number, delta: number) => void;
  onSetWordTime: (wordIdx: number, newBegin: number) => void;
  onNudgeWordEnd: (wordIdx: number, delta: number) => void;
  onSetWordEndTime: (wordIdx: number, newEnd: number) => void;
  onNudgeLine: (delta: number) => void;
  onSetLineTime: (newBegin: number) => void;
  onSplitWord: (wordIdx: number, newWords: WordTiming[]) => void;
  onNudgeBgWord: (wordIdx: number, delta: number) => void;
  onSetBgWordTime: (wordIdx: number, newBegin: number) => void;
  onNudgeBgWordEnd: (wordIdx: number, delta: number) => void;
  onSetBgWordEndTime: (wordIdx: number, newEnd: number) => void;
}

type LatestHandlers = React.RefObject<SyncLineListHandlers>;

// -- Functions ----------------------------------------------------------------

function rowCallbacksFor(latest: LatestHandlers, index: number): RowCallbacks {
  return {
    onClick: () => latest.current.handleJumpToLine(index),
    onClickWord: (wordIdx) => latest.current.handleJumpToWord(index, wordIdx),
    onClickBgWord: (wordIdx) => latest.current.handleJumpToBgWord(index, wordIdx),
    onNudgeWord: (wordIdx, delta) => latest.current.handleNudgeWord(index, wordIdx, delta),
    onSetWordTime: (wordIdx, newBegin) => latest.current.handleSetWordTime(index, wordIdx, newBegin),
    onNudgeWordEnd: (wordIdx, delta) => latest.current.handleNudgeWordEnd(index, wordIdx, delta),
    onSetWordEndTime: (wordIdx, newEnd) => latest.current.handleSetWordEndTime(index, wordIdx, newEnd),
    onNudgeLine: (delta) => latest.current.handleNudgeLine(index, delta),
    onSetLineTime: (newBegin) => latest.current.handleSetLineTime(index, newBegin),
    onSplitWord: (wordIdx, newWords) => latest.current.handleSplitWord(index, wordIdx, newWords),
    onNudgeBgWord: (wordIdx, delta) => latest.current.handleNudgeBgWord(index, wordIdx, delta),
    onSetBgWordTime: (wordIdx, newBegin) => latest.current.handleSetBgWordTime(index, wordIdx, newBegin),
    onNudgeBgWordEnd: (wordIdx, delta) => latest.current.handleNudgeBgWordEnd(index, wordIdx, delta),
    onSetBgWordEndTime: (wordIdx, newEnd) => latest.current.handleSetBgWordEndTime(index, wordIdx, newEnd),
  };
}

// -- Hooks --------------------------------------------------------------------

// Rows keep one set of callbacks per line index for the list's lifetime, and each call reaches the newest handlers.
function useRowCallbacks(handlers: SyncLineListHandlers): (index: number) => RowCallbacks {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const [byIndex] = useState(() => new Map<number, RowCallbacks>());
  return useCallback(
    (index) => {
      const cached = byIndex.get(index);
      if (cached) return cached;
      const callbacks = rowCallbacksFor(latest, index);
      byIndex.set(index, callbacks);
      return callbacks;
    },
    [byIndex],
  );
}

// -- Exports ------------------------------------------------------------------

export { useRowCallbacks };
export type { SyncLineListHandlers };
