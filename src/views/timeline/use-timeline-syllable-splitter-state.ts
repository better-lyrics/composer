import { reconcileTransliterationAfterSyllableSplit } from "@/domain/language/reconcile-syllable-split";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { WordTiming } from "@/domain/word/timing";
import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { buildApplyToAllConfirmOptions } from "@/utils/apply-to-all-confirm-options";
import { findIdenticalWords } from "@/utils/identical-word-matcher";
import { splitWordIntoSyllables } from "@/utils/single-word-syllable-split";
import { handleWordChangeWithDivergenceCheck } from "@/utils/word-divergence-flow";
import { splitWordIntoWords } from "@/utils/word-split";
import { splitSourceWord } from "@/utils/word-timing";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useState } from "react";

// -- Types --------------------------------------------------------------------

type SplitMode = "syllable" | "word";

interface SplitterTarget {
  lineId: string;
  wordIndex: number;
  type: "word" | "bg";
  word: WordTiming;
  mode: SplitMode;
}

interface UseTimelineSyllableSplitterStateParams {
  target: SplitterTarget | null;
  splitPoints: number[];
  transliterationSplitPoints?: number[];
  resetSplitPoints: () => void;
  closeModal: () => void;
}

interface UseTimelineSyllableSplitterStateResult {
  applyToAll: boolean;
  setApplyToAll: (next: boolean) => void;
  caseInsensitive: boolean;
  setCaseInsensitive: (next: boolean) => void;
  identicalCount: number;
  sourceText: string;
  confirmSplit: () => Promise<void>;
}

// -- Hook ---------------------------------------------------------------------

function useTimelineSyllableSplitterState({
  target,
  splitPoints,
  transliterationSplitPoints,
  resetSplitPoints,
  closeModal,
}: UseTimelineSyllableSplitterStateParams): UseTimelineSyllableSplitterStateResult {
  const initialDefaults = useProjectStore.getState().syllableSplitDefaults;
  const [applyToAll, setApplyToAll] = useState(initialDefaults.applyToAll);
  const [caseInsensitive, setCaseInsensitive] = useState(initialDefaults.caseInsensitive);

  const targetKey = target ? `${target.lineId}:${target.wordIndex}:${target.type}` : null;

  useEffect(() => {
    if (!targetKey) return;
    const stored = useProjectStore.getState().syllableSplitDefaults;
    setApplyToAll(stored.applyToAll);
    setCaseInsensitive(stored.caseInsensitive);
  }, [targetKey]);

  const lines = useProjectStore((s) => s.lines);
  const confirm = useConfirm();

  const identicalCount = useMemo(() => {
    if (!target || target.mode === "word") return 0;
    return findIdenticalWords(
      lines,
      { lineId: target.lineId, wordIndex: target.wordIndex, type: target.type },
      { caseInsensitive, excludeSource: true, splitPoints },
    ).length;
  }, [lines, target, caseInsensitive, splitPoints]);

  const sourceText = target?.word.text.trimEnd() ?? "";

  const applySingleWordSplit = useCallback(() => {
    if (!target || splitPoints.length === 0) return;
    const { lineId, wordIndex, type, word, mode } = target;
    const trimmedText = word.text.trimEnd();

    let newWords: WordTiming[];

    if (mode === "word") {
      newWords = splitWordIntoWords(word, splitPoints);
    } else {
      const audioEl = useAudioStore.getState().audioElement;
      const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
      const playheadOnWord = currentTime > word.begin && currentTime < word.end;

      if (playheadOnWord && splitPoints.length === 1) {
        const groupId = word.syllableGroupId ?? nanoid(8);
        const sourceForSplit: WordTiming = { ...word, syllableGroupId: groupId };
        const partitions = [
          { text: trimmedText.slice(0, splitPoints[0]), begin: word.begin, end: currentTime },
          { text: trimmedText.slice(splitPoints[0]), begin: currentTime, end: word.end },
        ];
        newWords = splitSourceWord(sourceForSplit, partitions);
        if (word.text.endsWith(" ") && newWords.length > 0) {
          const last = newWords[newWords.length - 1];
          newWords[newWords.length - 1] = { ...last, text: `${last.text} ` };
        }
      } else {
        newWords = splitWordIntoSyllables({ word, splitPoints, transliterationSplitPoints, reuseGroupId: true });
      }
    }

    if (word.transliteration && transliterationSplitPoints && newWords.length > 0) {
      const romanParts = splitWordIntoSyllables({
        word: { ...word, text: word.transliteration, transliteration: undefined },
        splitPoints: transliterationSplitPoints,
      }).map((part) => part.text.trimEnd());
      if (romanParts.length === newWords.length) {
        newWords = newWords.map((part, index) => ({ ...part, transliteration: romanParts[index] }));
      }
    }

    const currentLines = useProjectStore.getState().lines;
    const line = currentLines.find((l) => l.id === lineId);
    if (!line) return;

    const wordsArray = type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return;

    const updatedWords = [...wordsArray.slice(0, wordIndex), ...newWords, ...wordsArray.slice(wordIndex + 1)];
    const transliteration =
      mode === "syllable"
        ? reconcileTransliterationAfterSyllableSplit(
            line,
            type === "word" ? "words" : "backgroundWords",
            wordIndex,
            newWords,
          )
        : null;
    const extraUpdates = transliteration ? { transliteration } : {};

    if (type === "word") {
      void handleWordChangeWithDivergenceCheck(lineId, updatedWords, "words", extraUpdates);
    } else {
      void handleWordChangeWithDivergenceCheck(lineId, updatedWords, "backgroundWords", {
        ...manualBackgroundWordEdit(updatedWords),
        ...extraUpdates,
      });
    }
  }, [target, splitPoints, transliterationSplitPoints]);

  const confirmSplit = useCallback(async () => {
    if (!target || splitPoints.length === 0) return;

    useProjectStore.getState().setSyllableSplitDefaults({ applyToAll, caseInsensitive });

    if (target.mode === "syllable" && !target.word.transliteration && applyToAll && identicalCount > 0) {
      const ok = await confirm(buildApplyToAllConfirmOptions({ identicalCount, sourceText }));
      if (!ok) return;
      useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
        source: { lineId: target.lineId, wordIndex: target.wordIndex, type: target.type },
        splitPoints,
        caseInsensitive,
      });
      resetSplitPoints();
      closeModal();
      return;
    }

    applySingleWordSplit();
    resetSplitPoints();
    closeModal();
  }, [
    target,
    splitPoints,
    applyToAll,
    caseInsensitive,
    identicalCount,
    sourceText,
    confirm,
    applySingleWordSplit,
    resetSplitPoints,
    closeModal,
  ]);

  return {
    applyToAll,
    setApplyToAll,
    caseInsensitive,
    setCaseInsensitive,
    identicalCount,
    sourceText,
    confirmSplit,
  };
}

// -- Exports ------------------------------------------------------------------

export { useTimelineSyllableSplitterState };
export type { SplitterTarget };
