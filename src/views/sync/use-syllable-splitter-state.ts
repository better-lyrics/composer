import type { WordTiming } from "@/domain/word/timing";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { buildApplyToAllConfirmOptions } from "@/utils/apply-to-all-confirm-options";
import { findIdenticalWords } from "@/utils/identical-word-matcher";
import { splitWordIntoSyllables } from "@/utils/single-word-syllable-split";
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
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [transliterationSplitPoints, setTransliterationSplitPoints] = useState<number[]>([]);
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
      setSplitPoints((prev) => {
        const next = prev.includes(index) ? prev.filter((p) => p !== index) : [...prev, index];
        if (word.transliteration) {
          const originalLength = word.text.trimEnd().length;
          const romanLength = word.transliteration.trim().length;
          const inferred = next.map((point) =>
            Math.max(1, Math.min(romanLength - 1, Math.round((point / originalLength) * romanLength))),
          );
          if (new Set(inferred).size === inferred.length) setTransliterationSplitPoints(inferred);
        }
        return next;
      });
    },
    [word.text, word.transliteration],
  );

  const toggleTransliterationSplit = useCallback((index: number) => {
    setTransliterationSplitPoints((prev) =>
      prev.includes(index) ? prev.filter((point) => point !== index) : [...prev, index],
    );
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
        setSplitPoints([]);
        setTransliterationSplitPoints([]);
        close();
        return;
      }

      splitSingleWord();
      setSplitPoints([]);
      setTransliterationSplitPoints([]);
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
    setSplitPoints([]);
    setTransliterationSplitPoints([]);
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
