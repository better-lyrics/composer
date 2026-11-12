import { useCallback } from "react";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import { trackWords } from "@/domain/line/tracks";
import { mergeWordsIntoTrack } from "@/domain/word/merge-track";
import type { WordTiming } from "@/domain/word/timing";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createTrackWordsFromTextAt } from "@/utils/sync-helpers";
import { findInsertionSlot } from "@/utils/word-spaces";
import { deleteSelectedWords } from "@/views/timeline/delete-selected-words";
import { storedLineTimeRange } from "@/views/timeline/stored-line-range";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { ContextMenuTargets } from "@/views/timeline/use-context-menu-targets";
import { runExplicitToggle, runSyllableMerge, runWordMerge } from "@/views/timeline/word-commands";

// -- Hook ---------------------------------------------------------------------

function useWordMenuActions(targets: ContextMenuTargets, clearContextMenu: () => void) {
  const { lines, explicitToggle, wordCommandTargets, mergeInfo, groupedWordInfo, clickedSelectionCount } = targets;
  const contextMenu = useTimelineStore((s) => s.contextMenu);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const duration = useAudioStore((s) => s.duration);

  const handleEditWord = useCallback(() => {
    const editable = wordCommandTargets?.editable;
    if (!editable) return;
    useTimelineStore
      .getState()
      .setEditingWord({ lineId: editable.lineId, wordIndex: editable.wordIndex, type: editable.type });
    noteGuideSignal("timeline.menuEditText");
    clearContextMenu();
  }, [wordCommandTargets, clearContextMenu]);

  // The splitter picks the word up from the selection when the menu event arrives.
  const splitFromMenu = useCallback(
    (eventName: "timeline:split-syllable" | "timeline:split-word") => {
      if (!wordCommandTargets?.editable) return;
      useTimelineStore.getState().setEditingWord(null);
      clearContextMenu();
      window.dispatchEvent(new CustomEvent(eventName));
    },
    [wordCommandTargets, clearContextMenu],
  );
  const handleSplitSyllables = useCallback(() => splitFromMenu("timeline:split-syllable"), [splitFromMenu]);
  const handleSplitWord = useCallback(() => splitFromMenu("timeline:split-word"), [splitFromMenu]);

  const handleToggleExplicit = useCallback(() => {
    if (!explicitToggle) return;
    runExplicitToggle(explicitToggle);
    clearContextMenu();
  }, [explicitToggle, clearContextMenu]);

  const handleDeleteWord = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return;
    if (clickedSelectionCount === null) {
      const { lineId, lineIndex, wordIndex, type } = contextMenu.target;
      useTimelineStore.getState().setSelectedWords([{ lineId, lineIndex, wordIndex, type }]);
    }
    deleteSelectedWords();
    noteGuideSignal("timeline.menuDelete");
    clearContextMenu();
  }, [contextMenu, clickedSelectionCount, clearContextMenu]);

  const handleAddWordHere = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "track") return;
    const { lineId, time, type } = contextMenu.target;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const { defaultWordDuration, minWordDuration } = useSettingsStore.getState();
    const existingWords = trackWords(line, type);
    const range = storedLineTimeRange(lineId, duration);
    const slot = findInsertionSlot(existingWords ?? [], time, defaultWordDuration, range, minWordDuration);
    if (!slot) {
      clearContextMenu();
      return;
    }

    const timedText = createTrackWordsFromTextAt(line, type, slot.begin, range.max);
    if (timedText) {
      updateLineWithHistory(lineId, type === "word" ? { words: timedText } : manualBackgroundWordEdit(timedText));
      clearContextMenu();
      return;
    }

    const newWord: WordTiming = { text: "... ", begin: slot.begin, end: slot.end };
    const words = mergeWordsIntoTrack(existingWords ?? [], [newWord]);
    const newIndex = words.findIndex((w) => w.begin === newWord.begin);

    if (type === "word") {
      updateLineWithHistory(lineId, { words });
    } else {
      updateLineWithHistory(lineId, manualBackgroundWordEdit(words));
    }
    const timeline = useTimelineStore.getState();
    timeline.clearSelection();
    timeline.setEditingWord({ lineId, wordIndex: newIndex, type });
    clearContextMenu();
  }, [contextMenu, lines, duration, updateLineWithHistory, clearContextMenu]);

  const handleMergeSyllables = useCallback(() => {
    const syllableMerge = wordCommandTargets?.syllableMerge;
    if (!syllableMerge) return;
    runSyllableMerge(syllableMerge);
    clearContextMenu();
  }, [wordCommandTargets, clearContextMenu]);

  const handleSnapSyllables = useCallback(() => {
    if (!groupedWordInfo) return;
    useProjectStore.getState().snapSyllablesFlush(groupedWordInfo.lineId, groupedWordInfo.field);
    clearContextMenu();
  }, [groupedWordInfo, clearContextMenu]);

  const handleMergeWords = useCallback(() => {
    if (!mergeInfo) return;
    runWordMerge(mergeInfo);
    clearContextMenu();
  }, [mergeInfo, clearContextMenu]);

  return {
    handleEditWord,
    handleSplitSyllables,
    handleSplitWord,
    handleToggleExplicit,
    handleDeleteWord,
    handleAddWordHere,
    handleMergeSyllables,
    handleSnapSyllables,
    handleMergeWords,
  };
}

// -- Exports ------------------------------------------------------------------

export { useWordMenuActions };
