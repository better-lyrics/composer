import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import type { LyricLine, SyllableTiming } from "@/stores/project";
import { NUDGE_AMOUNT, type SyncState, getLineTiming, splitIntoWords } from "@/utils/sync-helpers";
import { nudgeBgWordBegin, setBgWordBegin, nudgeBgWordEnd, setBgWordEnd } from "@/utils/timing/bg-word-timing";
import { nudgeLineBegin, setLineBegin } from "@/utils/timing/line-timing";
import {
  splitWordIntoSyllables,
  nudgeSyllableBegin,
  setSyllableBegin,
  nudgeSyllableEnd,
  setSyllableEnd,
} from "@/utils/timing/syllable-timing";
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

  const { lineIndex, wordIndex } = syncState.position;
  const currentLine = lines[lineIndex];
  const prevLine = lines[lineIndex - 1];
  const isComplete = lineIndex >= lines.length && lines.length > 0;

  const handleTapWord = useCallback(() => {
    if (lines.length === 0 || isComplete) return;

    const line = lines[lineIndex];
    if (!line) return;

    const lineWords = splitIntoWords(line.text);
    const wordText = lineWords[wordIndex];
    if (!wordText) return;

    const existingWords = wordIndex === 0 ? [] : (line.words ?? []);

    if (existingWords.length > 0) {
      const updatedWords = [...existingWords];
      updatedWords[updatedWords.length - 1] = {
        ...updatedWords[updatedWords.length - 1],
        end: currentTime,
      };
      updatedWords.push({
        text: wordText,
        begin: currentTime,
        end: currentTime,
      });
      updateLineWithHistory(line.id, { words: updatedWords });
    } else {
      const updates: Partial<LyricLine> = {
        words: [{ text: wordText, begin: currentTime, end: currentTime }],
      };
      if (line.backgroundText && !line.backgroundWords?.length) {
        const bgWordTexts = splitIntoWords(line.backgroundText);
        updates.backgroundWords = bgWordTexts.map((text) => ({
          text,
          begin: currentTime,
          end: currentTime,
        }));
      }
      updateLineWithHistory(line.id, updates);
    }

    if (wordIndex === 0 && prevLine?.words?.length) {
      const prevWords = [...prevLine.words];
      prevWords[prevWords.length - 1] = {
        ...prevWords[prevWords.length - 1],
        end: currentTime,
      };
      updateLine(prevLine.id, { words: prevWords });
    }

    setShowPulse(true);
    setTimeout(() => setShowPulse(false), 100);

    const nextWordIndex = wordIndex + 1;
    if (nextWordIndex >= lineWords.length) {
      setSyncState((prev) => ({
        ...prev,
        position: { lineIndex: lineIndex + 1, wordIndex: 0 },
      }));
    } else {
      setSyncState((prev) => ({
        ...prev,
        position: { ...prev.position, wordIndex: nextWordIndex },
      }));
    }
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
      updateLine(prevLine.id, { end: currentTime });
    }

    const updates: Partial<LyricLine> = { begin: currentTime, end: currentTime };
    if (line.backgroundText && !line.backgroundWords?.length) {
      const bgWordTexts = splitIntoWords(line.backgroundText);
      updates.backgroundWords = bgWordTexts.map((text) => ({
        text,
        begin: currentTime,
        end: currentTime,
      }));
    }
    updateLineWithHistory(line.id, updates);

    setShowPulse(true);
    setTimeout(() => setShowPulse(false), 100);

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

  const handleTap = granularity === "word" ? handleTapWord : handleTapLine;

  const handleReset = useCallback(() => {
    for (const line of lines) {
      updateLine(line.id, {
        words: undefined,
        begin: undefined,
        end: undefined,
        backgroundWords: undefined,
      });
    }
    setSyncState({ position: { lineIndex: 0, wordIndex: 0 }, isActive: false });
  }, [lines, updateLine, setSyncState]);

  const handleStartSync = useCallback(() => {
    setSyncState({ position: { lineIndex: 0, wordIndex: 0 }, isActive: true });
    setIsPlaying(true);
  }, [setIsPlaying, setSyncState]);

  const handleJumpToLine = useCallback(
    (index: number) => {
      if (editMode) {
        const timing = getLineTiming(lines[index]);
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
    (lineIdx: number, wordIdx: number, syllables: SyllableTiming[]) =>
      splitWordIntoSyllables(lines, lineIdx, wordIdx, syllables, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleNudgeSyllable = useCallback(
    (lineIdx: number, wordIdx: number, syllableIdx: number, delta: number) =>
      nudgeSyllableBegin(lines, lineIdx, wordIdx, syllableIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetSyllableTime = useCallback(
    (lineIdx: number, wordIdx: number, syllableIdx: number, newBegin: number) =>
      setSyllableBegin(lines, lineIdx, wordIdx, syllableIdx, newBegin, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleNudgeSyllableEnd = useCallback(
    (lineIdx: number, wordIdx: number, syllableIdx: number, delta: number) =>
      nudgeSyllableEnd(lines, lineIdx, wordIdx, syllableIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetSyllableEndTime = useCallback(
    (lineIdx: number, wordIdx: number, syllableIdx: number, newEnd: number) =>
      setSyllableEnd(lines, lineIdx, wordIdx, syllableIdx, newEnd, updateLineWithHistory),
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
    handleNudgeSyllable,
    handleSetSyllableTime,
    handleNudgeSyllableEnd,
    handleSetSyllableEndTime,
    handleNudgeBgWord,
    handleSetBgWordTime,
    handleNudgeBgWordEnd,
    handleSetBgWordEndTime,
    isComplete,
    currentLine,
    currentWord: currentLine ? splitIntoWords(currentLine.text)[wordIndex] : undefined,
  };
}

// -- Exports ------------------------------------------------------------------

export { useSyncHandlers, NUDGE_AMOUNT };
