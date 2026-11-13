import { languageSide, pieceOf, trackPieces } from "@/domain/language/pieces";
import type { ReadableLine } from "@/domain/line/effective-words";
import { trackWords } from "@/domain/line/track";
import { resolveAddresses } from "@/domain/selection/resolve";
import { copiedSyllable } from "@/domain/word/syllable-groups";
import { pluralize } from "@/utils/pluralize";
import { buildCandidateLines } from "@/views/timeline/build-candidate-lines";
import { deleteSelectedWords } from "@/views/timeline/delete-selected-words";
import { selectedBannerInstance } from "@/views/timeline/selected-banner";
import type { ClipboardData, ClipboardEntry } from "@/views/timeline/selection-types";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback } from "react";
import { toast } from "sonner";

// -- Hook ---------------------------------------------------------------------

function useTimelineClipboard(lines: readonly ReadableLine[]) {
  const handleCopy = useCallback(() => {
    const { selectedWords } = useTimelineStore.getState();
    const resolved = resolveAddresses(lines, selectedWords);
    if (resolved.length === 0) return;

    const minLineIndex = Math.min(...resolved.map((w) => w.lineIndex));
    const entries: ClipboardEntry[] = [];

    const copiedByTrack = new Map<string, Set<number>>();
    for (const w of resolved) {
      const key = `${w.lineIndex}:${w.type}`;
      copiedByTrack.set(key, (copiedByTrack.get(key) ?? new Set()).add(w.wordIndex));
    }
    for (const sel of resolved) {
      const line = lines[sel.lineIndex];
      if (!line) continue;
      const wordsArray = trackWords(line, sel.type);
      if (!wordsArray?.[sel.wordIndex]) continue;

      const piece = pieceOf(trackPieces(line, languageSide(sel.type)), wordsArray[sel.wordIndex]);
      entries.push({
        word: copiedSyllable(wordsArray, sel.wordIndex, copiedByTrack.get(`${sel.lineIndex}:${sel.type}`) ?? new Set()),
        lineOffset: sel.lineIndex - minLineIndex,
        trackType: sel.type,
        ...(piece && { piece }),
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

  const handleCut = useCallback(() => {
    handleCopy();
    deleteSelectedWords();
  }, [handleCopy]);

  const handlePaste = useCallback(() => {
    const { clipboard, pasteMode } = useTimelineStore.getState();
    if (!clipboard || clipboard.entries.length === 0) return;

    if (pasteMode.status === "preview") {
      useTimelineStore.getState().setPasteMode({ status: "idle" });
    } else {
      useTimelineStore.getState().setPasteMode({ status: "preview", clipboard });
    }
  }, []);

  return { handleCopy, handleCut, handlePaste };
}

// -- Exports ------------------------------------------------------------------

export { useTimelineClipboard };
