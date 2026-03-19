import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import type { WordTiming } from "@/stores/project";
import { Modal } from "@/ui/modal";
import { distributeTiming } from "@/utils/syllable-utils";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { SplitModeContent } from "@/views/sync/syllable-splitter";
import { useCallback, useEffect, useState } from "react";

// -- Component ----------------------------------------------------------------

const TimelineSyllableSplitter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [target, setTarget] = useState<{
    lineId: string;
    wordIndex: number;
    type: "word" | "bg";
    word: WordTiming;
  } | null>(null);

  useEffect(() => {
    const handleSplitEvent = () => {
      const { selectedWords } = useTimelineStore.getState();
      if (selectedWords.length !== 1) return;

      const sel = selectedWords[0];
      const lines = useProjectStore.getState().lines;
      const line = lines.find((l) => l.id === sel.lineId);
      if (!line) return;

      const wordsArray = sel.type === "word" ? line.words : line.backgroundWords;
      const word = wordsArray?.[sel.wordIndex];
      if (!word || word.text.trimEnd().length < 2) return;

      setTarget({ lineId: sel.lineId, wordIndex: sel.wordIndex, type: sel.type, word });
      setSplitPoints([]);
      setIsOpen(true);
    };

    window.addEventListener("timeline:split-syllable", handleSplitEvent);
    return () => window.removeEventListener("timeline:split-syllable", handleSplitEvent);
  }, []);

  const handleToggleSplit = useCallback((index: number) => {
    setSplitPoints((prev) => (prev.includes(index) ? prev.filter((p) => p !== index) : [...prev, index]));
  }, []);

  const handleConfirm = useCallback(() => {
    if (!target || splitPoints.length === 0) return;

    const { lineId, wordIndex, type, word } = target;
    const trimmedText = word.text.trimEnd();

    // Check if playhead is over this word right now
    const audioEl = useAudioStore.getState().audioElement;
    const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
    const playheadOnWord = currentTime > word.begin && currentTime < word.end;

    let newWords: WordTiming[];

    if (playheadOnWord && splitPoints.length === 1) {
      // Single split with playhead on word - use exact playhead time as boundary
      const splitIdx = splitPoints[0];
      newWords = [
        { text: trimmedText.slice(0, splitIdx), begin: word.begin, end: currentTime },
        { text: trimmedText.slice(splitIdx), begin: currentTime, end: word.end },
      ];
    } else {
      newWords = distributeTiming(trimmedText, splitPoints, word.begin, word.end);
    }

    // Preserve trailing space on the last part if original had one
    if (word.text.endsWith(" ") && newWords.length > 0) {
      const last = newWords[newWords.length - 1];
      newWords[newWords.length - 1] = { ...last, text: `${last.text} ` };
    }

    const lines = useProjectStore.getState().lines;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const wordsArray = type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return;

    const updatedWords = [...wordsArray.slice(0, wordIndex), ...newWords, ...wordsArray.slice(wordIndex + 1)];

    const updateLineWithHistory = useProjectStore.getState().updateLineWithHistory;
    if (type === "word") {
      updateLineWithHistory(lineId, { words: updatedWords });
    } else {
      updateLineWithHistory(lineId, {
        backgroundWords: updatedWords,
        backgroundText: updatedWords
          .map((w) => w.text)
          .join("")
          .trimEnd(),
      });
    }

    setIsOpen(false);
    setTarget(null);
    setSplitPoints([]);
  }, [target, splitPoints]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTarget(null);
    setSplitPoints([]);
  }, []);

  if (!target) return null;

  const trimmedText = target.word.text.trimEnd();

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Split "${trimmedText}"`}>
      <SplitModeContent
        text={trimmedText}
        splitPoints={splitPoints}
        onToggleSplit={handleToggleSplit}
        onConfirm={handleConfirm}
        onCancel={handleClose}
      />
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimelineSyllableSplitter };
