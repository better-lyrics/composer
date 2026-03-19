import { type LyricLine, useProjectStore } from "@/stores/project";
import type { ClipboardEntry } from "@/views/timeline/selection-types";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback } from "react";
import { toast } from "sonner";

// -- Hook ---------------------------------------------------------------------

function useTimelineClipboard(lines: LyricLine[]) {
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

  return { handleCopy, handleDelete, handleCut, handlePaste };
}

// -- Exports ------------------------------------------------------------------

export { useTimelineClipboard };
