import type { ReadableLine } from "@/domain/line/effective-words";
import { trackWords } from "@/domain/line/tracks";
import { useProjectStore } from "@/stores/project";
import { pluralize } from "@/utils/pluralize";
import { applyWordDeletion } from "@/views/timeline/apply-word-deletion";
import { buildCandidateLines } from "@/views/timeline/build-candidate-lines";
import { selectedBannerInstance } from "@/views/timeline/selected-banner";
import type { ClipboardData, ClipboardEntry } from "@/views/timeline/selection-types";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback } from "react";
import { toast } from "sonner";

// -- Hook ---------------------------------------------------------------------

function useTimelineClipboard(lines: readonly ReadableLine[]) {
  const handleCopy = useCallback(() => {
    const { selectedWords } = useTimelineStore.getState();
    if (selectedWords.length === 0) return;

    const minLineIndex = Math.min(...selectedWords.map((w) => w.lineIndex));
    const entries: ClipboardEntry[] = [];

    for (const sel of selectedWords) {
      const line = lines[sel.lineIndex];
      if (!line) continue;
      const wordsArray = trackWords(line, sel.type);
      const word = wordsArray?.[sel.wordIndex];
      if (!word) continue;

      entries.push({
        word: { ...word },
        lineOffset: sel.lineIndex - minLineIndex,
        trackType: sel.type,
      });
    }

    if (entries.length === 0) return;

    entries.sort((a, b) => a.lineOffset - b.lineOffset || a.word.begin - b.word.begin);

    const clipboard: ClipboardData = { entries };
    const sourceInstance = selectedBannerInstance(lines, selectedWords);
    if (sourceInstance) {
      clipboard.sourceInstance = sourceInstance;
    } else {
      const candidateLines = buildCandidateLines(lines, selectedWords);
      if (candidateLines) clipboard.candidateLines = candidateLines;
    }

    useTimelineStore.getState().setClipboard(clipboard);
    toast(
      sourceInstance
        ? `Copied linked instance (${pluralize(entries.length, "word")})`
        : `Copied ${pluralize(entries.length, "word")}`,
    );
  }, [lines]);

  const handleDelete = useCallback(() => {
    const { selectedWords } = useTimelineStore.getState();
    if (selectedWords.length === 0) return;

    const rawLines = useProjectStore.getState().lines;
    const newLines = applyWordDeletion(rawLines, selectedWords);
    if (newLines === rawLines) return;

    useProjectStore.getState().setLinesWithHistory(newLines);
    useTimelineStore.getState().clearSelection();
  }, []);

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
