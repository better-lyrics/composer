import type { WordTiming } from "@/domain/word/timing";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { buildApplyToAllConfirmOptions } from "@/utils/apply-to-all-confirm-options";
import { findIdenticalWords } from "@/utils/identical-word-matcher";
import { splitWordIntoSyllables } from "@/utils/single-word-syllable-split";
import {
  type PairedSplitPoints,
  togglePrimarySplitPoint,
  toggleTransliterationSplitPoint,
} from "@/views/sync/paired-split-points";
import { useCallback, useMemo, useState } from "react";

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
  identicalCount: number;
  toggleSplit: (index: number) => void;
  toggleTransliterationSplit: (index: number) => void;
  setApplyToAll: (next: boolean) => void;
  setCaseInsensitive: (next: boolean) => void;
  confirmSplit: (close: () => void) => Promise<void>;
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

  const lines = useProjectStore((s) => s.lines);
  const confirm = useConfirm();

  const identicalCount = useMemo(
    () =>
      findIdenticalWords(lines, { lineId, wordIndex, type }, { caseInsensitive, excludeSource: true, splitPoints })
        .length,
    [lines, lineId, wordIndex, type, caseInsensitive, splitPoints],
  );

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
  }, [word, splitPoints, transliterationSplitPoints, wordIndex, onSplit]);

  const confirmSplit = useCallback(
    async (close: () => void) => {
      const store = useProjectStore.getState();
      store.setSyllableSplitDefaults({ applyToAll, caseInsensitive });

      if (applyToAll && identicalCount > 0) {
        const sourceText = word.text.trimEnd();
        const ok = await confirm(buildApplyToAllConfirmOptions({ identicalCount, sourceText }));
        if (!ok) return;
        useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
          source: { lineId, wordIndex, type },
          splitPoints,
          caseInsensitive,
        });
        setPairedSplitPoints({ splitPoints: [], transliterationSplitPoints: [] });
        close();
        return;
      }

      splitSingleWord();
      setPairedSplitPoints({ splitPoints: [], transliterationSplitPoints: [] });
      close();
    },
    [
      applyToAll,
      caseInsensitive,
      identicalCount,
      word.text,
      confirm,
      lineId,
      wordIndex,
      type,
      splitPoints,
      splitSingleWord,
    ],
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
    identicalCount,
    toggleSplit,
    toggleTransliterationSplit,
    setApplyToAll,
    setCaseInsensitive,
    confirmSplit,
    cancelSplit,
  };
}

// -- Exports ------------------------------------------------------------------

export { useSyllableSplitterState };
