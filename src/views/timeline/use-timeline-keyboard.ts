import { useAudioStore } from "@/stores/audio";
import { type LyricLine, useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { GUTTER_WIDTH, type WordSelection, useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineClipboard } from "@/views/timeline/use-timeline-clipboard";
import { findWordAtTime, getLineTiming } from "@/views/timeline/utils";
import { type RefObject, useCallback, useEffect } from "react";
import { toast } from "sonner";

// -- Constants -----------------------------------------------------------------

const WAVEFORM_HEIGHT = 80;
const BG_DROP_ZONE_HEIGHT = 24;

// -- Hook ----------------------------------------------------------------------

function useTimelineKeyboard(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  lines: LyricLine[],
  duration: number,
  onOpenLyricsModal?: () => void,
) {
  const { handleCopy, handleDelete, handleCut, handlePaste } = useTimelineClipboard(lines);

  const handleSetWordTiming = useCallback(
    (edge: "begin" | "end") => {
      const audioEl = useAudioStore.getState().audioElement;
      const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;

      const { selectedWords, zoom, rowHeights, defaultRowHeight } = useTimelineStore.getState();
      const selectedWord = selectedWords[0] ?? null;
      const fromPlayhead = !selectedWord;
      const targetWord = selectedWord ?? findWordAtTime(lines, currentTime);
      if (!targetWord) return;

      const line = lines[targetWord.lineIndex];
      if (!line) return;

      const wordsArray = targetWord.type === "word" ? line.words : line.backgroundWords;
      if (!wordsArray) return;

      const wordIndex = targetWord.wordIndex;
      const word = wordsArray[wordIndex];
      if (!word) return;

      const scrollContainer = scrollContainerRef.current;

      if (fromPlayhead && scrollContainer) {
        let rowTop = WAVEFORM_HEIGHT;
        for (let i = 0; i < targetWord.lineIndex; i++) {
          const l = lines[i];
          const mainHeight = rowHeights[l.id] ?? defaultRowHeight;
          const hasBg = l.backgroundWords && l.backgroundWords.length > 0;
          rowTop += mainHeight + (hasBg ? mainHeight : BG_DROP_ZONE_HEIGHT) + 1;
        }
        const mainHeight = rowHeights[line.id] ?? defaultRowHeight;
        const hasBg = line.backgroundWords && line.backgroundWords.length > 0;
        const rowHeight = mainHeight + (hasBg ? mainHeight : BG_DROP_ZONE_HEIGHT) + 1;

        const visibleTop = scrollContainer.scrollTop;
        const visibleBottom = visibleTop + scrollContainer.clientHeight;
        const rowBottom = rowTop + rowHeight;
        const isRowVisible = rowTop >= visibleTop && rowBottom <= visibleBottom;

        if (!isRowVisible) {
          scrollContainer.scrollTo({ top: rowTop - WAVEFORM_HEIGHT, behavior: "instant" });
        }

        const wordLeft = word.begin * zoom;
        const wordRight = word.end * zoom;
        const visibleLeft = scrollContainer.scrollLeft;
        const visibleRight = visibleLeft + scrollContainer.clientWidth - GUTTER_WIDTH;
        const isWordHorizontallyVisible = wordLeft >= visibleLeft && wordRight <= visibleRight;

        if (!isWordHorizontallyVisible) {
          toast("Word is off-screen", {
            action: {
              label: "Jump to word",
              onClick: () => {
                scrollContainer.scrollTo({
                  left: Math.max(0, wordLeft - 50),
                  behavior: "smooth",
                });
              },
            },
          });
        }
      }

      const updatedWords = [...wordsArray];

      if (edge === "begin") {
        const prevEnd = wordIndex > 0 ? wordsArray[wordIndex - 1].end : 0;
        const maxBegin = word.end - useSettingsStore.getState().minWordDuration;
        const clampedBegin = Math.max(prevEnd, Math.min(maxBegin, Math.max(0, currentTime)));
        updatedWords[wordIndex] = { ...word, begin: clampedBegin };
      } else {
        const minEnd = word.begin + useSettingsStore.getState().minWordDuration;
        const nextBegin = wordIndex < wordsArray.length - 1 ? wordsArray[wordIndex + 1].begin : duration;
        const clampedEnd = Math.min(nextBegin, Math.max(minEnd, Math.min(duration, currentTime)));
        updatedWords[wordIndex] = { ...word, end: clampedEnd };
      }

      const updateLineWithHistory = useProjectStore.getState().updateLineWithHistory;
      if (targetWord.type === "word") {
        updateLineWithHistory(line.id, { words: updatedWords });
      } else {
        updateLineWithHistory(line.id, { backgroundWords: updatedWords });
      }
    },
    [lines, duration, scrollContainerRef],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollContainerRef is a stable ref, .current should not be a dep
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (useProjectStore.getState().activeTab !== "timeline") return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        if (e.shiftKey) {
          useProjectStore.getState().redo();
        } else {
          useProjectStore.getState().undo();
        }
        return;
      }

      if (e.code === "KeyC" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        handleCopy();
        return;
      }

      if (e.code === "KeyX" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        handleCut();
        return;
      }

      if (e.code === "KeyV" && (e.metaKey || e.ctrlKey) && e.shiftKey && !e.repeat) {
        e.preventDefault();
        onOpenLyricsModal?.();
        return;
      }

      if (e.code === "KeyV" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        handlePaste();
        return;
      }

      if (e.code === "KeyA" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        const allSelections: WordSelection[] = [];
        for (let li = 0; li < lines.length; li++) {
          const line = lines[li];
          for (let wi = 0; wi < (line.words?.length ?? 0); wi++)
            allSelections.push({ lineId: line.id, lineIndex: li, wordIndex: wi, type: "word" });
          for (let wi = 0; wi < (line.backgroundWords?.length ?? 0); wi++)
            allSelections.push({ lineId: line.id, lineIndex: li, wordIndex: wi, type: "bg" });
        }
        useTimelineStore.getState().setSelectedWords(allSelections);
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;

        const audioEl = useAudioStore.getState().audioElement;
        const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
        const { zoom, rowHeights, defaultRowHeight } = useTimelineStore.getState();

        const viewportWidth = scrollContainer.clientWidth;
        scrollContainer.scrollLeft = Math.max(0, currentTime * zoom - viewportWidth / 2 + GUTTER_WIDTH);

        let activeLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          const timing = getLineTiming(lines[i]);
          if (timing && currentTime >= timing.begin && currentTime < timing.end) {
            activeLineIndex = i;
            break;
          }
        }

        if (activeLineIndex >= 0) {
          let rowTop = WAVEFORM_HEIGHT;
          for (let i = 0; i < activeLineIndex; i++) {
            const l = lines[i];
            const mainHeight = rowHeights[l.id] ?? defaultRowHeight;
            const hasBg = l.backgroundWords && l.backgroundWords.length > 0;
            rowTop += mainHeight + (hasBg ? mainHeight : BG_DROP_ZONE_HEIGHT) + 1;
          }
          const line = lines[activeLineIndex];
          const mainHeight = rowHeights[line.id] ?? defaultRowHeight;
          const hasBg = line.backgroundWords && line.backgroundWords.length > 0;
          const rowHeight = mainHeight + (hasBg ? mainHeight : BG_DROP_ZONE_HEIGHT) + 1;

          const viewportHeight = scrollContainer.clientHeight;
          const rowCenter = rowTop + rowHeight / 2;
          const targetTop = Math.max(
            0,
            Math.min(scrollContainer.scrollHeight - viewportHeight, rowCenter - viewportHeight / 2),
          );
          scrollContainer.scrollTo({ top: targetTop, behavior: "instant" });
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedWords } = useTimelineStore.getState();
        if (selectedWords.length > 0) {
          e.preventDefault();
          handleDelete();
          return;
        }
      }

      switch (e.key) {
        case "Escape": {
          const { pasteMode } = useTimelineStore.getState();
          if (pasteMode.status === "preview") {
            useTimelineStore.getState().setPasteMode({ status: "idle" });
          } else {
            useTimelineStore.getState().clearSelection();
          }
          break;
        }
        case "f":
        case "F":
          useTimelineStore.getState().toggleFollow();
          break;
        case "p":
        case "P":
          useTimelineStore.getState().togglePreviewSidebar();
          break;
        case "[":
          e.preventDefault();
          handleSetWordTiming("begin");
          break;
        case "]":
          e.preventDefault();
          handleSetWordTiming("end");
          break;
        case "n":
        case "N": {
          const { selectedWords: nSel } = useTimelineStore.getState();
          if (nSel.length === 0) break;
          const lineIndex = nSel[0].lineIndex;
          const agents = useProjectStore.getState().agents;
          const defaultAgentId = agents[0]?.id ?? "v1";
          const newLine = { id: crypto.randomUUID(), text: "", agentId: defaultAgentId };
          const newLines = [...lines];
          const insertIndex = e.shiftKey ? lineIndex : lineIndex + 1;
          newLines.splice(insertIndex, 0, newLine);
          useProjectStore.getState().setLinesWithHistory(newLines);
          break;
        }
        case "F2":
        case "e":
        case "E": {
          const { selectedWords: eSel } = useTimelineStore.getState();
          if (eSel.length === 1) {
            e.preventDefault();
            useTimelineStore.getState().setEditingWord({
              lineId: eSel[0].lineId,
              wordIndex: eSel[0].wordIndex,
              type: eSel[0].type,
            });
          }
          break;
        }
        case "s":
        case "S": {
          const { selectedWords: sSel } = useTimelineStore.getState();
          if (sSel.length === 1) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("timeline:split-syllable"));
          }
          break;
        }
        case "m":
        case "M": {
          const { selectedWords: mSel } = useTimelineStore.getState();
          if (mSel.length < 2) break;
          const first = mSel[0];
          if (!mSel.every((w) => w.lineId === first.lineId && w.type === first.type)) break;
          const sorted = [...mSel].sort((a, b) => a.wordIndex - b.wordIndex);
          let consecutive = true;
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].wordIndex !== sorted[i - 1].wordIndex + 1) {
              consecutive = false;
              break;
            }
          }
          if (!consecutive) break;
          const mLine = lines.find((l) => l.id === first.lineId);
          if (!mLine) break;
          const mWords = first.type === "word" ? mLine.words : mLine.backgroundWords;
          if (!mWords) break;
          let spaceFree = true;
          for (let i = 0; i < sorted.length - 1; i++) {
            if (mWords[sorted[i].wordIndex].text.endsWith(" ")) {
              spaceFree = false;
              break;
            }
          }
          if (!spaceFree) break;
          e.preventDefault();
          const firstIdx = sorted[0].wordIndex;
          const lastIdx = sorted[sorted.length - 1].wordIndex;
          const mergedText = sorted.map((s) => mWords[s.wordIndex].text).join("");
          const merged = { text: mergedText, begin: mWords[firstIdx].begin, end: mWords[lastIdx].end };
          const updatedWords = [...mWords.slice(0, firstIdx), merged, ...mWords.slice(lastIdx + 1)];
          const { updateLineWithHistory: mergeUpdate } = useProjectStore.getState();
          if (first.type === "word") {
            mergeUpdate(first.lineId, {
              words: updatedWords,
              text: updatedWords
                .map((w) => w.text)
                .join("")
                .trimEnd(),
            });
          } else {
            mergeUpdate(first.lineId, {
              backgroundWords: updatedWords,
              backgroundText: updatedWords
                .map((w) => w.text)
                .join("")
                .trimEnd(),
            });
          }
          useTimelineStore.getState().clearSelection();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSetWordTiming, handleCopy, handleCut, handlePaste, handleDelete, onOpenLyricsModal, lines]);
}

// -- Exports -------------------------------------------------------------------

export { useTimelineKeyboard };
