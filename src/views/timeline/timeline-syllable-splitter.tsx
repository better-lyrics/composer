import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import type { WordTiming } from "@/domain/word/timing";
import { Modal } from "@/ui/modal";
import { distributeTiming } from "@/utils/syllable-utils";
import { splitSourceWord } from "@/utils/word-timing";
import { handleWordChangeWithDivergenceCheck } from "@/utils/word-divergence-flow";
import { splitWordIntoWords } from "@/utils/word-split";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { SplitModeContent } from "@/views/sync/syllable-splitter";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";

// -- Types --------------------------------------------------------------------

type SplitMode = "syllable" | "word";

// -- Component ----------------------------------------------------------------

const TimelineSyllableSplitter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [target, setTarget] = useState<{
    lineId: string;
    wordIndex: number;
    type: "word" | "bg";
    word: WordTiming;
    mode: SplitMode;
  } | null>(null);

  useEffect(() => {
    const openSplitModal = (mode: SplitMode) => {
      const { selectedWords } = useTimelineStore.getState();
      if (selectedWords.length !== 1) return;

      const sel = selectedWords[0];
      const lines = useProjectStore.getState().lines;
      const line = lines.find((l) => l.id === sel.lineId);
      if (!line) return;

      const wordsArray = sel.type === "word" ? line.words : line.backgroundWords;
      const word = wordsArray?.[sel.wordIndex];
      if (!word || word.text.trimEnd().length < 2) return;

      setTarget({ lineId: sel.lineId, wordIndex: sel.wordIndex, type: sel.type, word, mode });
      setSplitPoints([]);
      setIsOpen(true);
    };

    const handleSplitSyllable = () => openSplitModal("syllable");
    const handleSplitWord = () => openSplitModal("word");

    window.addEventListener("timeline:split-syllable", handleSplitSyllable);
    window.addEventListener("timeline:split-word", handleSplitWord);
    return () => {
      window.removeEventListener("timeline:split-syllable", handleSplitSyllable);
      window.removeEventListener("timeline:split-word", handleSplitWord);
    };
  }, []);

  const handleToggleSplit = useCallback((index: number) => {
    setSplitPoints((prev) => (prev.includes(index) ? prev.filter((p) => p !== index) : [...prev, index]));
  }, []);

  const handleConfirm = useCallback(() => {
    if (!target || splitPoints.length === 0) return;

    const { lineId, wordIndex, type, word, mode } = target;
    const trimmedText = word.text.trimEnd();

    let newWords: WordTiming[];

    if (mode === "word") {
      newWords = splitWordIntoWords(word, splitPoints);
    } else {
      // Check if playhead is over this word right now
      const audioEl = useAudioStore.getState().audioElement;
      const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
      const playheadOnWord = currentTime > word.begin && currentTime < word.end;

      const groupId = word.syllableGroupId ?? nanoid(8);
      const sourceForSplit: WordTiming = { ...word, syllableGroupId: groupId };

      const partitions =
        playheadOnWord && splitPoints.length === 1
          ? [
              { text: trimmedText.slice(0, splitPoints[0]), begin: word.begin, end: currentTime },
              { text: trimmedText.slice(splitPoints[0]), begin: currentTime, end: word.end },
            ]
          : distributeTiming(trimmedText, splitPoints, word.begin, word.end);

      newWords = splitSourceWord(sourceForSplit, partitions);

      if (word.text.endsWith(" ") && newWords.length > 0) {
        const last = newWords[newWords.length - 1];
        newWords[newWords.length - 1] = { ...last, text: `${last.text} ` };
      }
    }

    const lines = useProjectStore.getState().lines;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const wordsArray = type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return;

    const updatedWords = [...wordsArray.slice(0, wordIndex), ...newWords, ...wordsArray.slice(wordIndex + 1)];

    void handleWordChangeWithDivergenceCheck(lineId, updatedWords, type === "word" ? "words" : "backgroundWords");

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
  const title = target.mode === "word" ? `Split "${trimmedText}" into words` : `Split "${trimmedText}"`;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
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
