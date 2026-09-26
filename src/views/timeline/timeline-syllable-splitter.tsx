import { getEffectiveLines } from "@/domain/line/effective-words";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { Modal } from "@/ui/modal";
import {
  type PairedSplitPoints,
  togglePrimarySplitPoint,
  toggleTransliterationSplitPoint,
} from "@/views/sync/paired-split-points";
import { SplitModeContent } from "@/views/sync/split-mode-content";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import {
  type SplitterTarget,
  useTimelineSyllableSplitterState,
} from "@/views/timeline/use-timeline-syllable-splitter-state";
import { useCallback, useEffect, useState } from "react";

// -- Types --------------------------------------------------------------------

type SplitMode = "syllable" | "word";

// -- Component ----------------------------------------------------------------

const TimelineSyllableSplitter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [pairedSplitPoints, setPairedSplitPoints] = useState<PairedSplitPoints>({
    splitPoints: [],
    transliterationSplitPoints: [],
  });
  const { splitPoints, transliterationSplitPoints } = pairedSplitPoints;
  const [target, setTarget] = useState<SplitterTarget | null>(null);

  useEffect(() => {
    const openSplitModal = (mode: SplitMode) => {
      const { selectedWords } = useTimelineStore.getState();
      if (selectedWords.length !== 1) return;

      const sel = selectedWords[0];
      const lines = getEffectiveLines(useProjectStore.getState().lines);
      const line = lines.find((l) => l.id === sel.lineId);
      if (!line) return;

      const wordsArray = sel.type === "word" ? line.words : line.backgroundWords;
      const word: WordTiming | undefined = wordsArray?.[sel.wordIndex];
      if (!word || word.text.trimEnd().length < 2) return;

      setTarget({ lineId: sel.lineId, wordIndex: sel.wordIndex, type: sel.type, word, mode });
      setPairedSplitPoints({ splitPoints: [], transliterationSplitPoints: [] });
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

  const handleToggleSplit = useCallback(
    (index: number) => {
      if (!target) return;
      setPairedSplitPoints((current) =>
        togglePrimarySplitPoint(current, index, target.word.text, target.word.transliteration),
      );
    },
    [target],
  );

  const handleToggleTransliterationSplit = useCallback((index: number) => {
    setPairedSplitPoints((current) => toggleTransliterationSplitPoint(current, index));
  }, []);

  const resetSplitPoints = useCallback(() => {
    setPairedSplitPoints({ splitPoints: [], transliterationSplitPoints: [] });
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setTarget(null);
    setPairedSplitPoints({ splitPoints: [], transliterationSplitPoints: [] });
  }, []);

  const { applyToAll, setApplyToAll, caseInsensitive, setCaseInsensitive, identicalCount, sourceText, confirmSplit } =
    useTimelineSyllableSplitterState({ target, splitPoints, transliterationSplitPoints, resetSplitPoints, closeModal });

  if (!target) return null;

  const trimmedText = target.word.text.trimEnd();
  const title = target.mode === "word" ? `Split "${trimmedText}" into words` : `Split "${trimmedText}"`;

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title={title}>
      <SplitModeContent
        text={trimmedText}
        splitPoints={splitPoints}
        onToggleSplit={handleToggleSplit}
        onConfirm={confirmSplit}
        onCancel={closeModal}
        applyToAll={applyToAll}
        onApplyToAllChange={setApplyToAll}
        caseInsensitive={caseInsensitive}
        onCaseInsensitiveChange={setCaseInsensitive}
        identicalCount={identicalCount}
        sourceText={sourceText}
        showApplyControls={target.mode === "syllable" && !target.word.transliteration}
        secondaryText={target.word.transliteration}
        secondarySplitPoints={transliterationSplitPoints}
        onToggleSecondarySplit={handleToggleTransliterationSplit}
      />
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimelineSyllableSplitter };
