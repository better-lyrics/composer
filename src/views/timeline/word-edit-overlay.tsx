import { cancelNextFrame, nextFrame } from "@/lib/frame-loop";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { typeWordText } from "@/domain/commands/word-structure";
import { drawnSyllables } from "@/domain/line/drawn-track";
import { trackRole } from "@/domain/line/track";
import { addressOf } from "@/domain/selection/resolve";
import { wordBlockId } from "@/views/timeline/word-block-id";
import { FloatingPortal } from "@floating-ui/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface WordEditOverlayProps {
  lineId: string;
  syllableId: string;
  type: "word" | "bg";
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// -- Component ----------------------------------------------------------------

const WordEditOverlay: React.FC<WordEditOverlayProps> = ({ lineId, syllableId, type, scrollContainerRef }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const lines = useProjectStore((s) => s.lines);
  const clearEditingWord = useTimelineStore((s) => s.clearEditingWord);

  const line = lines.find((l) => l.id === lineId);
  const wordsArray = line ? drawnSyllables(line, trackRole(type)) : undefined;
  const wordIndex = wordsArray?.findIndex((candidate) => candidate.id === syllableId) ?? -1;
  const word = wordsArray?.[wordIndex];

  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !word) return;

    const key = wordBlockId(lineId, type, wordIndex);

    const zoom = useTimelineStore.getState().zoom;
    const expectedLeft = word.begin * zoom;

    const findAndPosition = () => {
      const wordEl = container.querySelector(`[data-word-block][id="${CSS.escape(key)}"]`) as HTMLElement | null;
      if (!wordEl) return false;
      const elLeft = Number.parseFloat(wordEl.style.left || "0");
      if (Math.abs(elLeft - expectedLeft) > 1) return false;
      const rect = wordEl.getBoundingClientRect();
      setPos({ top: rect.top - 32, left: rect.left, width: Math.max(rect.width, 80) });
      return true;
    };

    const followScroll = () => {
      findAndPosition();
    };
    container.addEventListener("scroll", followScroll, { passive: true });
    const frame = findAndPosition()
      ? null
      : nextFrame(() => {
          if (!findAndPosition()) clearEditingWord();
        });
    return () => {
      container.removeEventListener("scroll", followScroll);
      if (frame !== null) cancelNextFrame(frame);
    };
  }, [lineId, wordIndex, type, word, scrollContainerRef, clearEditingWord]);

  const isPlaced = pos !== null;
  useEffect(() => {
    if (!isPlaced) return;
    const frame = nextFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelNextFrame(frame);
  }, [isPlaced]);

  const handleCommit = useCallback(
    (value: string) => {
      if (!line || !word) return;
      const trimmed = value.trim();
      if (trimmed && trimmed !== word.text) {
        useProjectStore.getState().commit(typeWordText(addressOf(line, type, word), trimmed));
        noteGuideSignal("timeline.editText");
      }
      clearEditingWord();
    },
    [line, word, type, clearEditingWord],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        handleCommit((e.target as HTMLInputElement).value);
      } else if (e.key === "Escape") {
        clearEditingWord();
      }
    },
    [handleCommit, clearEditingWord],
  );

  const commitWordEdit = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      handleCommit(e.target.value);
    },
    [handleCommit],
  );

  if (!word || !pos) return null;

  return (
    <FloatingPortal>
      <input
        ref={inputRef}
        type="text"
        aria-label="Edit word"
        defaultValue={word.text}
        onKeyDown={handleKeyDown}
        onBlur={commitWordEdit}
        className="fixed layer-floating px-2 py-1.5 text-sm text-composer-text bg-composer-bg border border-composer-border rounded-lg cursor-text focus:outline-none focus:border-composer-accent"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
      />
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { WordEditOverlay };
