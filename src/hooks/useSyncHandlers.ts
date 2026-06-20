import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import type { LooseLine, LyricLine } from "@/domain/line/model";
import { isLineSynced, hasAnyTiming } from "@/domain/line/predicates";
import { lineText, mainWords } from "@/domain/line/voices";
import type { WordTiming } from "@/domain/word/timing";
import { useSettingsStore } from "@/stores/settings";
import { effectiveBounds } from "@/domain/line/bounds";
import {
  commitHeldWord,
  commitTappedWord,
  type SyncState,
  splitIntoWords,
  splitIntoWordsWithMeta,
} from "@/utils/sync-helpers";
import {
  advanceSyncPosition,
  buildInitialWordUpdates,
  prepareSyncWord,
  triggerPulse,
  withBgSeedIfNeeded,
} from "@/hooks/useSyncHandlers.helpers";
import { nudgeBgWordBegin, setBgWordBegin, nudgeBgWordEnd, setBgWordEnd } from "@/utils/timing/bg-word-timing";
import { nudgeLineBegin, setLineBegin } from "@/utils/timing/line-timing";
import { nudgeWordBegin, setWordBegin, nudgeWordEnd, setWordEnd } from "@/utils/timing/word-timing";
import { useCallback } from "react";

// -- Types --------------------------------------------------------------------

interface UseSyncHandlersProps {
  lines: LyricLine[];
  syncState: SyncState;
  setSyncState: React.Dispatch<React.SetStateAction<SyncState>>;
  currentTime: number;
  editMode: boolean;
  granularity: "line" | "word";
  setShowPulse: (show: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
}

// -- Hook ---------------------------------------------------------------------

function useSyncHandlers({
  lines,
  syncState,
  setSyncState,
  currentTime,
  editMode,
  granularity,
  setShowPulse,
  setIsPlaying,
}: UseSyncHandlersProps) {
  const seekTo = useAudioStore((s) => s.seekTo);
  const updateLine = useProjectStore((s) => s.updateLine);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const confirm = useConfirm();

  const { lineIndex, wordIndex } = syncState.position;
  const currentLine = lines[lineIndex];
  const prevLine = lines[lineIndex - 1];
  const isComplete = lineIndex >= lines.length && lines.length > 0;

  const handleTapWord = useCallback(() => {
    const prepared = prepareSyncWord(lines, lineIndex, wordIndex, isComplete);
    if (!prepared) return;
    const { line, lineWords, textWithSpace } = prepared;

    const fallbackEnd = currentTime + useSettingsStore.getState().defaultWordDuration;
    const existingWords = mainWords(line) ?? [];

    if (existingWords.length > 0) {
      const updatedWords = commitTappedWord(existingWords, wordIndex, textWithSpace, currentTime, fallbackEnd);
      updateLineWithHistory(line.id, { words: updatedWords }, { deriveText: false, propagateToSiblings: false });
    } else {
      const updates = buildInitialWordUpdates(line, textWithSpace, currentTime, fallbackEnd);
      updateLineWithHistory(line.id, updates, { deriveText: false, propagateToSiblings: false });
    }

    const prevWordsForTap = prevLine ? mainWords(prevLine) : undefined;
    if (wordIndex === 0 && prevLine && prevWordsForTap?.length) {
      const prevWords = [...prevWordsForTap];
      prevWords[prevWords.length - 1] = {
        ...prevWords[prevWords.length - 1],
        end: currentTime,
      };
      updateLine(prevLine.id, { words: prevWords }, { deriveText: false });
    }

    triggerPulse(setShowPulse);
    advanceSyncPosition(setSyncState, lineIndex, wordIndex, lineWords.length);
  }, [
    lines,
    lineIndex,
    wordIndex,
    currentTime,
    updateLine,
    updateLineWithHistory,
    isComplete,
    prevLine,
    setShowPulse,
    setSyncState,
  ]);

  const handleTapLine = useCallback(() => {
    if (lines.length === 0 || isComplete) return;

    const line = lines[lineIndex];
    if (!line) return;

    if (prevLine && isLineSynced(prevLine)) {
      updateLine(prevLine.id, { end: currentTime }, { deriveText: false });
    }

    const updates = withBgSeedIfNeeded<Partial<LooseLine>>({ begin: currentTime, end: currentTime }, line, currentTime);
    updateLineWithHistory(line.id, updates, { deriveText: false, propagateToSiblings: false });

    triggerPulse(setShowPulse);
    setSyncState((prev) => ({
      ...prev,
      position: { lineIndex: lineIndex + 1, wordIndex: 0 },
    }));
  }, [
    lines,
    lineIndex,
    currentTime,
    updateLine,
    updateLineWithHistory,
    isComplete,
    prevLine,
    setShowPulse,
    setSyncState,
  ]);

  const handleHoldStart = useCallback(() => {
    const prepared = prepareSyncWord(lines, lineIndex, wordIndex, isComplete);
    if (!prepared) return;
    const { line, textWithSpace } = prepared;

    const existingWords = mainWords(line) ?? [];

    if (existingWords.length > 0) {
      const updatedWords = commitHeldWord(existingWords, wordIndex, textWithSpace, currentTime);
      updateLineWithHistory(line.id, { words: updatedWords }, { deriveText: false, propagateToSiblings: false });
    } else {
      const updates = buildInitialWordUpdates(line, textWithSpace, currentTime, currentTime);
      updateLineWithHistory(line.id, updates, { deriveText: false, propagateToSiblings: false });
    }

    const prevWordsForHold = prevLine ? mainWords(prevLine) : undefined;
    if (wordIndex === 0 && prevLine && prevWordsForHold?.length) {
      const prevWords = [...prevWordsForHold];
      const lastPrevWord = prevWords[prevWords.length - 1];
      if (lastPrevWord.end === lastPrevWord.begin) {
        prevWords[prevWords.length - 1] = { ...lastPrevWord, end: currentTime };
        updateLine(prevLine.id, { words: prevWords }, { deriveText: false });
      }
    }
  }, [lines, lineIndex, wordIndex, currentTime, updateLine, updateLineWithHistory, isComplete, prevLine]);

  const handleHoldEnd = useCallback(() => {
    if (lines.length === 0 || isComplete) return;

    const line = lines[lineIndex];
    const holdEndWords = line ? mainWords(line) : undefined;
    if (!line || !holdEndWords?.length) return;

    const { parts: lineWords } = splitIntoWordsWithMeta(lineText(line));

    const updatedWords = [...holdEndWords];
    const currentWordEntry = updatedWords[updatedWords.length - 1];
    updatedWords[updatedWords.length - 1] = { ...currentWordEntry, end: currentTime };
    updateLineWithHistory(line.id, { words: updatedWords }, { deriveText: false, propagateToSiblings: false });

    triggerPulse(setShowPulse);
    advanceSyncPosition(setSyncState, lineIndex, wordIndex, lineWords.length);
  }, [lines, lineIndex, wordIndex, currentTime, updateLineWithHistory, isComplete, setShowPulse, setSyncState]);

  const handleHoldTap = useCallback(() => {
    if (lines.length === 0 || isComplete) return;

    const line = lines[lineIndex];
    const holdTapWords = line ? mainWords(line) : undefined;
    if (!line || !holdTapWords?.length) return;

    const { parts: lineWords, trailingSpace } = splitIntoWordsWithMeta(lineText(line));

    const updatedWords = [...holdTapWords];
    const currentWordEntry = updatedWords[updatedWords.length - 1];
    updatedWords[updatedWords.length - 1] = { ...currentWordEntry, end: currentTime };

    const nextWordIndex = wordIndex + 1;
    const advancesToNextLine = nextWordIndex >= lineWords.length;

    if (advancesToNextLine) {
      updateLineWithHistory(line.id, { words: updatedWords }, { deriveText: false, propagateToSiblings: false });

      const nextLine = lines[lineIndex + 1];
      if (nextLine) {
        const { parts: nextLineWords, trailingSpace: nextTrailingSpace } = splitIntoWordsWithMeta(lineText(nextLine));
        const nextWordText = nextLineWords[0];
        if (nextWordText) {
          const textWithSpace = nextTrailingSpace[0] ? `${nextWordText} ` : nextWordText;
          const nextUpdates = buildInitialWordUpdates(nextLine, textWithSpace, currentTime, currentTime);
          updateLineWithHistory(nextLine.id, nextUpdates, { deriveText: false, propagateToSiblings: false });
        }
      }

      setSyncState((prev) => ({
        ...prev,
        position: { lineIndex: lineIndex + 1, wordIndex: 0 },
      }));
    } else {
      const nextWordText = lineWords[nextWordIndex];
      if (nextWordText) {
        const textWithSpace = trailingSpace[nextWordIndex] ? `${nextWordText} ` : nextWordText;
        updatedWords.push({ text: textWithSpace, begin: currentTime, end: currentTime });
      }
      updateLineWithHistory(line.id, { words: updatedWords }, { deriveText: false, propagateToSiblings: false });

      setSyncState((prev) => ({
        ...prev,
        position: { ...prev.position, wordIndex: nextWordIndex },
      }));
    }

    triggerPulse(setShowPulse);
  }, [lines, lineIndex, wordIndex, currentTime, updateLineWithHistory, isComplete, setShowPulse, setSyncState]);

  const handleTap = granularity === "word" ? handleTapWord : handleTapLine;

  const handleReset = useCallback(async () => {
    const anyLineTimed = lines.some((line) => hasAnyTiming(line));
    if (anyLineTimed) {
      const ok = await confirm({
        title: "Reset all sync timing?",
        description: "Clear every word and line timing in this project.",
        confirmLabel: "Reset",
        variant: "destructive",
        settingsKey: "confirmSyncReset",
        recoverable: true,
      });
      if (!ok) return;
    }

    const updates = lines.map((line) => ({
      id: line.id,
      updates: {
        words: undefined,
        begin: undefined,
        end: undefined,
        backgroundWords: undefined,
      },
    }));
    useProjectStore.getState().updateLinesWithHistory(updates, { propagateToSiblings: false });
    setSyncState({ position: { lineIndex: 0, wordIndex: 0 }, isActive: false });
  }, [lines, setSyncState, confirm]);

  const handleStartSync = useCallback(() => {
    setSyncState({ position: { lineIndex: 0, wordIndex: 0 }, isActive: true });
    setIsPlaying(true);
  }, [setIsPlaying, setSyncState]);

  const handleJumpToLine = useCallback(
    (index: number) => {
      if (editMode) {
        const timing = effectiveBounds(lines[index]);
        if (timing) {
          seekTo(timing.begin);
        }
        return;
      }
      setSyncState((prev) => ({
        ...prev,
        position: { lineIndex: index, wordIndex: 0 },
      }));
    },
    [editMode, lines, seekTo, setSyncState],
  );

  const handleNudgeWord = useCallback(
    (lineIdx: number, wordIdx: number, delta: number) =>
      nudgeWordBegin(lines, lineIdx, wordIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetWordTime = useCallback(
    (lineIdx: number, wordIdx: number, newBegin: number) =>
      setWordBegin(lines, lineIdx, wordIdx, newBegin, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleNudgeWordEnd = useCallback(
    (lineIdx: number, wordIdx: number, delta: number) =>
      nudgeWordEnd(lines, lineIdx, wordIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetWordEndTime = useCallback(
    (lineIdx: number, wordIdx: number, newEnd: number) =>
      setWordEnd(lines, lineIdx, wordIdx, newEnd, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleNudgeLine = useCallback(
    (lineIdx: number, delta: number) => nudgeLineBegin(lines, lineIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetLineTime = useCallback(
    (lineIdx: number, newBegin: number) => setLineBegin(lines, lineIdx, newBegin, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleNudgeLastSynced = useCallback(
    (delta: number) => {
      if (granularity === "line") {
        for (let i = lines.length - 1; i >= 0; i--) {
          if (isLineSynced(lines[i])) {
            handleNudgeLine(i, delta);
            return;
          }
        }
      } else {
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          const lineWords = mainWords(line);
          if (lineWords?.length) {
            const lastWordIdx = lineWords.length - 1;
            handleNudgeWord(i, lastWordIdx, delta);
            return;
          }
        }
      }
    },
    [granularity, lines, handleNudgeWord, handleNudgeLine],
  );

  const handleSplitWord = useCallback(
    (lineIdx: number, wordIdx: number, newWords: WordTiming[]) => {
      const line = lines[lineIdx];
      const splitWords = line ? mainWords(line) : undefined;
      if (!line || !splitWords) return;

      const updatedWords = [...splitWords];
      updatedWords.splice(wordIdx, 1, ...newWords);
      const newLineText = updatedWords
        .map((w) => w.text)
        .join("")
        .trimEnd();
      updateLineWithHistory(line.id, { words: updatedWords, text: newLineText });
    },
    [lines, updateLineWithHistory],
  );

  const handleNudgeBgWord = useCallback(
    (lineIdx: number, wordIdx: number, delta: number) =>
      nudgeBgWordBegin(lines, lineIdx, wordIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetBgWordTime = useCallback(
    (lineIdx: number, wordIdx: number, newBegin: number) =>
      setBgWordBegin(lines, lineIdx, wordIdx, newBegin, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleNudgeBgWordEnd = useCallback(
    (lineIdx: number, wordIdx: number, delta: number) =>
      nudgeBgWordEnd(lines, lineIdx, wordIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetBgWordEndTime = useCallback(
    (lineIdx: number, wordIdx: number, newEnd: number) =>
      setBgWordEnd(lines, lineIdx, wordIdx, newEnd, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  return {
    handleTap,
    handleHoldStart,
    handleHoldEnd,
    handleHoldTap,
    handleReset,
    handleStartSync,
    handleJumpToLine,
    handleNudgeWord,
    handleSetWordTime,
    handleNudgeWordEnd,
    handleSetWordEndTime,
    handleNudgeLine,
    handleSetLineTime,
    handleNudgeLastSynced,
    handleSplitWord,
    handleNudgeBgWord,
    handleSetBgWordTime,
    handleNudgeBgWordEnd,
    handleSetBgWordEndTime,
    isComplete,
    currentLine,
    currentWord: currentLine && lineText(currentLine) ? splitIntoWords(lineText(currentLine))[wordIndex] : undefined,
  };
}

// -- Exports ------------------------------------------------------------------

export { useSyncHandlers };
