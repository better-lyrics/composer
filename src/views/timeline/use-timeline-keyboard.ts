import { useAudioStore } from "@/stores/audio";
import { type LyricLine, useProjectStore } from "@/stores/project";
import type { ClipboardEntry } from "@/views/timeline/selection-types";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { findWordAtTime } from "@/views/timeline/utils";
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
) {
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
        const maxBegin = word.end - 0.05;
        const clampedBegin = Math.max(prevEnd, Math.min(maxBegin, Math.max(0, currentTime)));
        updatedWords[wordIndex] = { ...word, begin: clampedBegin };
      } else {
        const minEnd = word.begin + 0.05;
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

  const handleCopy = useCallback(() => {
    const { selectedWords } = useTimelineStore.getState();
    if (selectedWords.length === 0) return;

    const minLineIndex = Math.min(...selectedWords.map((w) => w.lineIndex));
    const entries: ClipboardEntry[] = [];

    for (const sel of selectedWords) {
      const line = lines[sel.lineIndex];
      if (!line) continue;
      const wordsArray = sel.type === "word" ? line.words : line.backgroundWords;
      const word = wordsArray?.[sel.wordIndex];
      if (!word) continue;

      entries.push({
        word: { ...word },
        lineOffset: sel.lineIndex - minLineIndex,
        trackType: sel.type,
      });
    }

    if (entries.length > 0) {
      useTimelineStore.getState().setClipboard({ entries });
      toast(`Copied ${entries.length} word${entries.length > 1 ? "s" : ""}`);
    }
  }, [lines]);

  const handleDelete = useCallback(() => {
    const { selectedWords } = useTimelineStore.getState();
    if (selectedWords.length === 0) return;

    const grouped = new Map<string, { wordIndices: number[]; bgIndices: number[] }>();
    for (const sel of selectedWords) {
      let entry = grouped.get(sel.lineId);
      if (!entry) {
        entry = { wordIndices: [], bgIndices: [] };
        grouped.set(sel.lineId, entry);
      }
      if (sel.type === "word") {
        entry.wordIndices.push(sel.wordIndex);
      } else {
        entry.bgIndices.push(sel.wordIndex);
      }
    }

    const updates: Array<{ id: string; updates: Partial<LyricLine> }> = [];
    for (const [lineId, { wordIndices, bgIndices }] of grouped) {
      const line = lines.find((l) => l.id === lineId);
      if (!line) continue;

      const lineUpdates: Partial<LyricLine> = {};
      if (wordIndices.length > 0 && line.words) {
        const wordSet = new Set(wordIndices);
        lineUpdates.words = line.words.filter((_, i) => !wordSet.has(i));
      }
      if (bgIndices.length > 0 && line.backgroundWords) {
        const bgSet = new Set(bgIndices);
        const remaining = line.backgroundWords.filter((_, i) => !bgSet.has(i));
        lineUpdates.backgroundWords = remaining.length > 0 ? remaining : undefined;
        lineUpdates.backgroundText = remaining.length > 0 ? remaining.map((w) => w.text).join("") : undefined;
      }

      updates.push({ id: lineId, updates: lineUpdates });
    }

    if (updates.length > 0) {
      useProjectStore.getState().updateLinesWithHistory(updates);
      useTimelineStore.getState().clearSelection();
    }
  }, [lines]);

  const handleCut = useCallback(() => {
    handleCopy();
    handleDelete();
  }, [handleCopy, handleDelete]);

  const handlePaste = useCallback(() => {
    const { clipboard, pasteMode } = useTimelineStore.getState();
    if (!clipboard || clipboard.entries.length === 0) return;

    if (pasteMode.status === "preview") {
      useTimelineStore.getState().setPasteMode({ status: "idle" });
    } else {
      useTimelineStore.getState().setPasteMode({ status: "preview", clipboard });
    }
  }, []);

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

      if (e.code === "KeyV" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        handlePaste();
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
        case " ":
        case "Enter": {
          e.preventDefault();
          const { isPlaying, setIsPlaying } = useAudioStore.getState();
          setIsPlaying(!isPlaying);
          break;
        }
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSetWordTiming, handleCopy, handleCut, handlePaste, handleDelete]);
}

// -- Exports -------------------------------------------------------------------

export { useTimelineKeyboard };
