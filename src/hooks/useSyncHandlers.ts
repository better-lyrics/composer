import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { useSettingsStore } from "@/stores/settings";
import { effectiveBounds } from "@/domain/line/bounds";
import {
  closeHeldWord,
  commitHeldWord,
  commitTappedWord,
  type SyncState,
  splitIntoWords,
  splitIntoWordsWithMeta,
} from "@/utils/sync-helpers";
import {
  advanceSyncPosition,
  buildInitialWordUpdates,
  isSyncableLine,
  nextSyncableLineIndex,
  prepareSyncWord,
  prevSyncableLine,
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
  const prevLine = prevSyncableLine(lines, lineIndex);
  const isComplete = lineIndex >= lines.length && lines.length > 0;

  const handleTapWord = useCallback(() => {
    const prepared = prepareSyncWord(lines, lineIndex, wordIndex, isComplete);
    if (!prepared) return;
    const { line, lineWords, textWithSpace } = prepared;

    const fallbackEnd = currentTime + useSettingsStore.getState().defaultWordDuration;
    const existingWords = line.words ?? [];

    if (existingWords.length > 0) {
      const updatedWords = commitTappedWord(existingWords, wordIndex, textWithSpace, currentTime, fallbackEnd);
      updateLineWithHistory(line.id, { words: updatedWords }, { deriveText: false, propagateToSiblings: false });
    } else {
      const updates = buildInitialWordUpdates(line, textWithSpace, currentTime, fallbackEnd);
      updateLineWithHistory(line.id, updates, { deriveText: false, propagateToSiblings: false });
    }

    if (wordIndex === 0 && prevLine?.words?.length) {
      const prevWords = [...prevLine.words];
      prevWords[prevWords.length - 1] = {
        ...prevWords[prevWords.length - 1],
        end: currentTime,
      };
      updateLine(prevLine.id, { words: prevWords }, { deriveText: false });
    }

    triggerPulse(setShowPulse);
    advanceSyncPosition(setSyncState, lines, lineIndex, wordIndex, lineWords.length);
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

    if (prevLine?.begin !== undefined) {
      updateLine(prevLine.id, { end: currentTime }, { deriveText: false });
    }

    const updates = withBgSeedIfNeeded<Partial<LyricLine>>({ begin: currentTime, end: currentTime }, line, currentTime);
    updateLineWithHistory(line.id, updates, { deriveText: false, propagateToSiblings: false });

    triggerPulse(setShowPulse);
    setSyncState((prev) => ({
      ...prev,
      position: { lineIndex: nextSyncableLineIndex(lines, lineIndex), wordIndex: 0 },
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

    const existingWords = line.words ?? [];

    if (existingWords.length > 0) {
      const updatedWords = commitHeldWord(existingWords, wordIndex, textWithSpace, currentTime);
      updateLineWithHistory(line.id, { words: updatedWords }, { deriveText: false, propagateToSiblings: false });
    } else {
      const updates = buildInitialWordUpdates(line, textWithSpace, currentTime, currentTime);
      updateLineWithHistory(line.id, updates, { deriveText: false, propagateToSiblings: false });
    }

    if (wordIndex === 0 && prevLine?.words?.length) {
      const prevWords = [...prevLine.words];
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
    if (!line?.words?.length) return;

    const { parts: lineWords } = splitIntoWordsWithMeta(line.text);

    const updatedWords = closeHeldWord(line.words, wordIndex, currentTime);
    updateLineWithHistory(line.id, { words: updatedWords }, { deriveText: false, propagateToSiblings: false });

    triggerPulse(setShowPulse);
    advanceSyncPosition(setSyncState, lines, lineIndex, wordIndex, lineWords.length);
  }, [lines, lineIndex, wordIndex, currentTime, updateLineWithHistory, isComplete, setShowPulse, setSyncState]);

  const handleHoldTap = useCallback(() => {
    if (lines.length === 0 || isComplete) return;

    const line = lines[lineIndex];
    if (!line?.words?.length) return;

    const { parts: lineWords, trailingSpace } = splitIntoWordsWithMeta(line.text);

    const closedWords = closeHeldWord(line.words, wordIndex, currentTime);

    const nextWordIndex = wordIndex + 1;
    const advancesToNextLine = nextWordIndex >= lineWords.length;

    if (advancesToNextLine) {
      updateLineWithHistory(line.id, { words: closedWords }, { deriveText: false, propagateToSiblings: false });

      const nextLineIndex = nextSyncableLineIndex(lines, lineIndex);
      const nextLine = lines[nextLineIndex];
      if (nextLine) {
        const { parts: nextLineWords, trailingSpace: nextTrailingSpace } = splitIntoWordsWithMeta(nextLine.text);
        const nextWordText = nextLineWords[0];
        if (nextWordText) {
          const textWithSpace = nextTrailingSpace[0] ? `${nextWordText} ` : nextWordText;
          const nextUpdates = buildInitialWordUpdates(nextLine, textWithSpace, currentTime, currentTime);
          updateLineWithHistory(nextLine.id, nextUpdates, { deriveText: false, propagateToSiblings: false });
        }
      }

      setSyncState((prev) => ({
        ...prev,
        position: { lineIndex: nextLineIndex, wordIndex: 0 },
      }));
    } else {
      const nextWordText = lineWords[nextWordIndex];
      const openedWords = nextWordText
        ? commitHeldWord(
            closedWords,
            nextWordIndex,
            trailingSpace[nextWordIndex] ? `${nextWordText} ` : nextWordText,
            currentTime,
          )
        : closedWords;
      updateLineWithHistory(line.id, { words: openedWords }, { deriveText: false, propagateToSiblings: false });

      setSyncState((prev) => ({
        ...prev,
        position: { ...prev.position, wordIndex: nextWordIndex },
      }));
    }

    triggerPulse(setShowPulse);
  }, [lines, lineIndex, wordIndex, currentTime, updateLineWithHistory, isComplete, setShowPulse, setSyncState]);

  const handleTap = granularity === "word" ? handleTapWord : handleTapLine;

  const handleReset = useCallback(async () => {
    const hasAnyTiming = lines.some(
      (line) =>
        line.words?.length || line.begin !== undefined || line.end !== undefined || line.backgroundWords?.length,
    );
    if (hasAnyTiming) {
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
    const { lineIndex: cursorLine, wordIndex: cursorWord } = syncState.position;
    const startLine = isSyncableLine(lines[cursorLine]) ? cursorLine : nextSyncableLineIndex(lines, -1);
    const startWord = startLine === cursorLine ? cursorWord : 0;
    setSyncState({ position: { lineIndex: startLine, wordIndex: startWord }, isActive: true });
    setIsPlaying(true);
  }, [lines, syncState.position, setIsPlaying, setSyncState]);

  // Re-recording seeks back and waits for the user to start playback. Edit mode
  // is the exception: there a click is a scrub for auditioning timings, so
  // playback is left alone.
  const seekForRedo = useCallback(
    (begin: number) => {
      if (editMode) {
        seekTo(begin);
        return;
      }
      setIsPlaying(false);
      const preroll = useSettingsStore.getState().redoPreroll;
      seekTo(Math.max(0, begin - preroll));
    },
    [editMode, seekTo, setIsPlaying],
  );

  const handleJumpToLine = useCallback(
    (index: number) => {
      setSyncState((prev) => ({
        ...prev,
        position: { lineIndex: index, wordIndex: 0 },
      }));
      const bounds = effectiveBounds(lines[index]);
      if (!bounds) return;
      seekForRedo(bounds.begin);
    },
    [lines, seekForRedo, setSyncState],
  );

  // Only a word that already carries timing can be re-recorded: parking the
  // cursor on an untimed word would make the next tap write it into slot 0 and
  // silently drop every word before it.
  const handleJumpToWord = useCallback(
    (lineIdx: number, wordIdx: number) => {
      const word = lines[lineIdx]?.words?.[wordIdx];
      if (!word) return;
      setSyncState((prev) => ({
        ...prev,
        position: { lineIndex: lineIdx, wordIndex: wordIdx },
      }));
      seekForRedo(word.begin);
    },
    [lines, seekForRedo, setSyncState],
  );

  // The sync cursor addresses main words only, so a background word can be
  // scrubbed to but not re-recorded from. Moving the cursor here would make the
  // next tap overwrite the main word at the same index.
  const handleJumpToBgWord = useCallback(
    (lineIdx: number, wordIdx: number) => {
      const word = lines[lineIdx]?.backgroundWords?.[wordIdx];
      if (!word) return;
      seekForRedo(word.begin);
    },
    [lines, seekForRedo],
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
          if (lines[i].begin !== undefined) {
            handleNudgeLine(i, delta);
            return;
          }
        }
      } else {
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          if (line.words?.length) {
            const lastWordIdx = line.words.length - 1;
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
      if (!line?.words) return;

      const updatedWords = [...line.words];
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
    handleJumpToWord,
    handleJumpToBgWord,
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
    currentWord: currentLine?.text ? splitIntoWords(currentLine.text)[wordIndex] : undefined,
  };
}

// -- Exports ------------------------------------------------------------------

export { useSyncHandlers };
