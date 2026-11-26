import { splitIdenticalSyllables } from "@/domain/commands/word-edits";
import {
  splitWordIntoWordsKeepingTransliteration,
  splitWordsKeepingTransliteration,
} from "@/domain/language/reconcile-syllable-split";
import { splitTransliterationAtBoundaries } from "@/domain/language/transliteration-format";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { SyllableAddress } from "@/domain/selection/model";
import { resolveAddress } from "@/domain/selection/resolve";
import type { WordTiming } from "@/domain/word/timing";
import { noteGuideSignal } from "@/lib/guide-signals";
import { livePlaybackTime } from "@/stores/audio";
import { useAlignmentStore } from "@/stores/alignment";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { buildApplyToAllConfirmOptions } from "@/utils/apply-to-all-confirm-options";
import { findIdenticalWords } from "@/utils/identical-word-matcher";
import { splitWordIntoSyllables } from "@/utils/single-word-syllable-split";
import { getSplitCharacter } from "@/utils/split-character";
import { handleWordChangeWithDivergenceCheck } from "@/utils/word-divergence-flow";
import { splitWordIntoWords } from "@/utils/word-split";
import { splitSourceWord } from "@/utils/word-timing";
import { useCallback, useEffect, useMemo, useState } from "react";

// -- Types --------------------------------------------------------------------

type SplitMode = "syllable" | "word";

interface SplitterTarget extends SyllableAddress {
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

  const targetKey = target ? `${target.lineId}:${target.syllableId}:${target.type}` : null;

  useEffect(() => {
    if (!targetKey) return;
    const stored = useProjectStore.getState().syllableSplitDefaults;
    setApplyToAll(stored.applyToAll);
    setCaseInsensitive(stored.caseInsensitive);
  }, [targetKey]);

  const lines = useProjectStore((s) => s.lines);
  const confirm = useConfirm();

  const identicalCount = useMemo(() => {
    const source = target?.mode === "syllable" ? resolveAddress(lines, target) : null;
    if (!source) return 0;
    return findIdenticalWords(
      lines,
      { lineId: source.lineId, wordIndex: source.wordIndex, type: source.type },
      { caseInsensitive, excludeSource: true, splitPoints },
    ).length;
  }, [lines, target, caseInsensitive, splitPoints]);

  const sourceText = target?.word.text ?? "";

  const applySingleWordSplit = useCallback(() => {
    if (!target || splitPoints.length === 0) return;
    const { lineId, type, word, mode } = target;
    const trimmedText = word.text;

    let newWords: WordTiming[];
    // A boundary placed at the playhead was set by ear, so the model doesn't move it.
    let placedByEar = false;

    if (mode === "word") {
      newWords = splitWordIntoWords(word, splitPoints);
    } else {
      const currentTime = livePlaybackTime();
      const playheadOnWord = currentTime > word.begin && currentTime < word.end;

      if (playheadOnWord && splitPoints.length === 1) {
        placedByEar = true;
        const partitions = [
          { text: trimmedText.slice(0, splitPoints[0]), begin: word.begin, end: currentTime },
          { text: trimmedText.slice(splitPoints[0]), begin: currentTime, end: word.end },
        ];
        newWords = splitSourceWord(word, partitions);
        if (word.sep.endsWith(" ") && newWords.length > 0) {
          const last = newWords[newWords.length - 1];
          newWords[newWords.length - 1] = { ...last, sep: `${last.sep} ` };
        }
      } else {
        newWords = splitWordIntoSyllables({ word, splitPoints, transliterationSplitPoints });
      }
    }

    if (word.transliteration && transliterationSplitPoints && newWords.length > 0) {
      const romanParts = splitTransliterationAtBoundaries(word.transliteration.trim(), transliterationSplitPoints);
      if (romanParts.length === newWords.length) {
        newWords = newWords.map((part, index) => {
          const { transliterationJoinerAfter: _joiner, ...withoutJoiner } = part;
          const slice = romanParts[index];
          return {
            ...withoutJoiner,
            transliteration: slice.text,
            ...(index < romanParts.length - 1
              ? { transliterationJoinerAfter: slice.joinerAfter ?? "" }
              : word.transliterationJoinerAfter !== undefined
                ? { transliterationJoinerAfter: word.transliterationJoinerAfter }
                : {}),
          };
        });
      }
    }

    const currentLines = useProjectStore.getState().lines;
    const source = resolveAddress(currentLines, target);
    if (!source) return;
    const line = currentLines[source.lineIndex];
    const { wordIndex } = source;

    const split =
      mode === "word"
        ? splitWordIntoWordsKeepingTransliteration(line, type, wordIndex, newWords, getSplitCharacter())
        : splitWordsKeepingTransliteration(line, type, wordIndex, newWords);
    if (!split) return;
    const extraUpdates = split.transliteration ? { transliteration: split.transliteration } : {};

    const done = (
      type === "word"
        ? handleWordChangeWithDivergenceCheck(lineId, split.words, "words", extraUpdates)
        : handleWordChangeWithDivergenceCheck(lineId, split.words, "backgroundWords", {
            ...manualBackgroundWordEdit(split.words),
            ...extraUpdates,
          })
    ).then((written) => {
      if (written) noteGuideSignal("timeline.split");
    });
    // Only a split that wasn't placed by ear is timed from the audio afterwards.
    return placedByEar ? undefined : done;
  }, [target, splitPoints, transliterationSplitPoints]);

  const confirmSplit = useCallback(async () => {
    if (!target || splitPoints.length === 0) return;

    useProjectStore.getState().setSyllableSplitDefaults({ applyToAll, caseInsensitive });
    // With the alignment model kept in memory, the new syllables are timed from the audio.
    const before = useProjectStore.getState().lines;
    const retime = () => void useAlignmentStore.getState().retimeNewSyllables(before);

    if (target.mode === "syllable" && !target.word.transliteration && applyToAll && identicalCount > 0) {
      const ok = await confirm(buildApplyToAllConfirmOptions({ identicalCount, sourceText }));
      if (!ok) return;
      const source = resolveAddress(useProjectStore.getState().lines, target);
      if (!source) return;
      useProjectStore.getState().commit(
        splitIdenticalSyllables({
          source: { lineId: source.lineId, wordIndex: source.wordIndex, type: source.type },
          splitPoints,
          caseInsensitive,
        }),
      );
      noteGuideSignal("timeline.split");
      retime();
      resetSplitPoints();
      closeModal();
      return;
    }

    void applySingleWordSplit()?.then(retime);
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

export type { SplitterTarget };
export { useTimelineSyllableSplitterState };
