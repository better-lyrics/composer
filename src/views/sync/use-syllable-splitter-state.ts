import type { WordTiming } from "@/domain/word/timing";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { findIdenticalWords } from "@/utils/identical-word-matcher";
import { distributeTiming } from "@/utils/syllable-utils";
import { splitSourceWord } from "@/utils/word-timing";
import { nanoid } from "nanoid";
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
  applyToAll: boolean;
  caseInsensitive: boolean;
  identicalCount: number;
  toggleSplit: (index: number) => void;
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
  const [applyToAll, setApplyToAll] = useState(initialDefaults.applyToAll);
  const [caseInsensitive, setCaseInsensitive] = useState(initialDefaults.caseInsensitive);

  const lines = useProjectStore((s) => s.lines);
  const confirm = useConfirm();

  const identicalCount = useMemo(
    () =>
      findIdenticalWords(lines, { lineId, wordIndex, type }, { caseInsensitive, excludeSource: true, splitPoints })
        .length,
    [lines, lineId, wordIndex, type, caseInsensitive, splitPoints],
  );

  const toggleSplit = useCallback((index: number) => {
    setSplitPoints((prev) => (prev.includes(index) ? prev.filter((p) => p !== index) : [...prev, index]));
  }, []);

  const splitSingleWord = useCallback(() => {
    const groupId = word.syllableGroupId ?? nanoid(8);
    const sourceForSplit: WordTiming = { ...word, syllableGroupId: groupId };
    const partitions = distributeTiming(word.text, splitPoints, word.begin, word.end);
    const newWords = splitSourceWord(sourceForSplit, partitions);
    onSplit(wordIndex, newWords);
  }, [word, splitPoints, wordIndex, onSplit]);

  const confirmSplit = useCallback(
    async (close: () => void) => {
      const store = useProjectStore.getState();
      store.setSyllableSplitDefaults({ applyToAll, caseInsensitive });

      if (applyToAll && identicalCount > 0) {
        const sourceText = word.text.trimEnd();
        const ok = await confirm({
          title: `Split ${identicalCount + 1} matching "${sourceText}"?`,
          description: `Apply this split to the source and ${identicalCount} other ${
            identicalCount === 1 ? "match" : "matches"
          }.`,
          confirmLabel: "Split",
          cancelLabel: "Cancel",
          variant: "primary",
          settingsKey: "confirmApplyToAllSyllableSplit",
          recoverable: true,
        });
        if (!ok) return;
        useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
          source: { lineId, wordIndex, type },
          splitPoints,
          caseInsensitive,
        });
        setSplitPoints([]);
        close();
        return;
      }

      splitSingleWord();
      setSplitPoints([]);
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
    close();
  }, []);

  return {
    splitPoints,
    applyToAll,
    caseInsensitive,
    identicalCount,
    toggleSplit,
    setApplyToAll,
    setCaseInsensitive,
    confirmSplit,
    cancelSplit,
  };
}

// -- Exports ------------------------------------------------------------------

export { useSyllableSplitterState };
