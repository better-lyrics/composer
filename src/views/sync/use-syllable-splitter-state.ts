import type { WordTiming } from "@/domain/word/timing";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useAlignmentStore } from "@/stores/alignment";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { buildApplyToAllConfirmOptions } from "@/utils/apply-to-all-confirm-options";
import { splitWordIntoSyllables } from "@/utils/single-word-syllable-split";
import {
  type PairedSplitPoints,
  togglePrimarySplitPoint,
  toggleTransliterationSplitPoint,
} from "@/views/sync/paired-split-points";
import { useCallback, useState } from "react";

// -- Types --------------------------------------------------------------------

interface UseSyllableSplitterStateParams {
  lineId: string;
  type: "word" | "bg";
  word: WordTiming;
  wordIndex: number;
  onSplit: (wordIndex: number, newWords: WordTiming[]) => void;
}

interface UseSyllableSplitterStateResult {
  splitPoints: number[];
  transliterationSplitPoints: number[];
  applyToAll: boolean;
  caseInsensitive: boolean;
  toggleSplit: (index: number) => void;
  toggleTransliterationSplit: (index: number) => void;
  setApplyToAll: (next: boolean) => void;
  setCaseInsensitive: (next: boolean) => void;
  confirmSplit: (close: () => void, identicalCount: number) => Promise<void>;
  cancelSplit: (close: () => void) => void;
}

// -- Hook ---------------------------------------------------------------------

function useSyllableSplitterState({
  lineId,
  type,
  word,
  wordIndex,
  onSplit,
}: UseSyllableSplitterStateParams): UseSyllableSplitterStateResult {
  const initialDefaults = useProjectStore.getState().syllableSplitDefaults;
  const [pairedSplitPoints, setPairedSplitPoints] = useState<PairedSplitPoints>({
    splitPoints: [],
    transliterationSplitPoints: [],
  });
  const { splitPoints, transliterationSplitPoints } = pairedSplitPoints;
  const [applyToAll, setApplyToAll] = useState(word.transliteration ? false : initialDefaults.applyToAll);
  const [caseInsensitive, setCaseInsensitive] = useState(initialDefaults.caseInsensitive);

  const confirm = useConfirm();

  const toggleSplit = useCallback(
    (index: number) => {
      setPairedSplitPoints((current) => togglePrimarySplitPoint(current, index, word.text, word.transliteration));
    },
    [word.text, word.transliteration],
  );

  const toggleTransliterationSplit = useCallback((index: number) => {
    setPairedSplitPoints((current) => toggleTransliterationSplitPoint(current, index));
  }, []);

  const splitSingleWord = useCallback(() => {
    const newWords = splitWordIntoSyllables({
      word,
      splitPoints,
      transliterationSplitPoints,
      reuseGroupId: true,
    });
    onSplit(wordIndex, newWords);
    noteGuideSignal("sync.split");
  }, [word, splitPoints, transliterationSplitPoints, wordIndex, onSplit]);

  const confirmSplit = useCallback(
    async (close: () => void, identicalCount: number) => {
      const store = useProjectStore.getState();
      store.setSyllableSplitDefaults({ applyToAll, caseInsensitive });
      // With the alignment model kept in memory, the new syllables are timed from the audio.
      const before = store.lines;
      const retime = () => void useAlignmentStore.getState().retimeNewSyllables(before);

      if (applyToAll && identicalCount > 0) {
        const sourceText = word.text;
        const ok = await confirm(buildApplyToAllConfirmOptions({ identicalCount, sourceText }));
        if (!ok) return;
        useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
          source: { lineId, wordIndex, type },
          splitPoints,
          caseInsensitive,
        });
        noteGuideSignal("sync.split");
        retime();
        setPairedSplitPoints({ splitPoints: [], transliterationSplitPoints: [] });
        close();
        return;
      }

      splitSingleWord();
      retime();
      setPairedSplitPoints({ splitPoints: [], transliterationSplitPoints: [] });
      close();
    },
    [applyToAll, caseInsensitive, word.text, confirm, lineId, wordIndex, type, splitPoints, splitSingleWord],
  );

  const cancelSplit = useCallback((close: () => void) => {
    setPairedSplitPoints({ splitPoints: [], transliterationSplitPoints: [] });
    close();
  }, []);

  return {
    splitPoints,
    transliterationSplitPoints,
    applyToAll,
    caseInsensitive,
    toggleSplit,
    toggleTransliterationSplit,
    setApplyToAll,
    setCaseInsensitive,
    confirmSplit,
    cancelSplit,
  };
}

// -- Exports ------------------------------------------------------------------

export type { UseSyllableSplitterStateResult };
export { useSyllableSplitterState };
