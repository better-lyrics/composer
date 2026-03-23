import { useProjectStore } from "@/stores/project";
import { GUTTER_WIDTH, type WordSelection, useTimelineStore } from "@/views/timeline/timeline-store";
import { getEffectiveLines } from "@/views/timeline/utils";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type MarqueeState = "idle" | "pending" | "active";

// -- Constants -----------------------------------------------------------------

const ACTIVATION_THRESHOLD = 5;
const WAVEFORM_HEIGHT = 80;
const BG_DROP_ZONE_HEIGHT = 24;
const AUTO_SCROLL_ZONE = 40;
const AUTO_SCROLL_SPEED = 8;

// -- Hook ----------------------------------------------------------------------

function useMarquee(scrollContainerRef: RefObject<HTMLDivElement | null>) {
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const stateRef = useRef<MarqueeState>("idle");
  const startRef = useRef({ clientX: 0, clientY: 0, scrollLeft: 0, scrollTop: 0 });
  const currentRef = useRef({ clientX: 0, clientY: 0 });
  const rafRef = useRef<number | null>(null);
  const shiftRef = useRef(false);

  const computeRect = useCallback((): MarqueeRect | null => {
    const container = scrollContainerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const start = startRef.current;
    const current = currentRef.current;

    const startX = start.clientX - containerRect.left + start.scrollLeft;
    const startY = start.clientY - containerRect.top + start.scrollTop;
    const currentX = current.clientX - containerRect.left + container.scrollLeft;
    const currentY = current.clientY - containerRect.top + container.scrollTop;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    return { x, y, width, height };
  }, [scrollContainerRef]);

  const computeSelection = useCallback((rect: MarqueeRect): WordSelection[] => {
    const lines = getEffectiveLines(useProjectStore.getState().lines);
    const { zoom, rowHeights, defaultRowHeight } = useTimelineStore.getState();
    const selections: WordSelection[] = [];

    let rowTop = WAVEFORM_HEIGHT;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const mainHeight = rowHeights[line.id] ?? defaultRowHeight;
      const hasBg = line.backgroundWords && line.backgroundWords.length > 0;
      const bgHeight = hasBg ? mainHeight : BG_DROP_ZONE_HEIGHT;
      const totalRowHeight = mainHeight + bgHeight + 1;

      const rowBottom = rowTop + totalRowHeight;
      const rectBottom = rect.y + rect.height;
      const rectRight = rect.x + rect.width;

      if (rowTop < rectBottom && rowBottom > rect.y) {
        const mainTop = rowTop;
        const mainBottom = rowTop + mainHeight;

        if (mainTop < rectBottom && mainBottom > rect.y && line.words) {
          for (let wordIndex = 0; wordIndex < line.words.length; wordIndex++) {
            const word = line.words[wordIndex];
            const wordLeft = GUTTER_WIDTH + word.begin * zoom;
            const wordRight = GUTTER_WIDTH + word.end * zoom;

            if (wordLeft < rectRight && wordRight > rect.x) {
              selections.push({ lineId: line.id, lineIndex, wordIndex, type: "word" });
            }
          }
        }

        if (hasBg && line.backgroundWords) {
          const bgTop = mainBottom;
          const bgBottom = bgTop + bgHeight;

          if (bgTop < rectBottom && bgBottom > rect.y) {
            for (let wordIndex = 0; wordIndex < line.backgroundWords.length; wordIndex++) {
              const word = line.backgroundWords[wordIndex];
              const wordLeft = GUTTER_WIDTH + word.begin * zoom;
              const wordRight = GUTTER_WIDTH + word.end * zoom;

              if (wordLeft < rectRight && wordRight > rect.x) {
                selections.push({ lineId: line.id, lineIndex, wordIndex, type: "bg" });
              }
            }
          }
        }
      }

      rowTop = rowBottom;
    }

    return selections;
  }, []);

  const handleMarqueeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      if (target.closest("[data-word-block]")) return;

      const container = scrollContainerRef.current;
      if (!container) return;

      stateRef.current = "pending";
      shiftRef.current = e.shiftKey;
      startRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
      currentRef.current = { clientX: e.clientX, clientY: e.clientY };
    },
    [scrollContainerRef],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (stateRef.current === "idle") return;

      currentRef.current = { clientX: e.clientX, clientY: e.clientY };

      if (stateRef.current === "pending") {
        const dx = e.clientX - startRef.current.clientX;
        const dy = e.clientY - startRef.current.clientY;
        if (Math.sqrt(dx * dx + dy * dy) < ACTIVATION_THRESHOLD) return;
        stateRef.current = "active";
      }

      const rect = computeRect();
      if (rect) {
        setMarqueeRect(rect);
      }

      if (rafRef.current === null) {
        const autoScroll = () => {
          const c = scrollContainerRef.current;
          if (!c || stateRef.current !== "active") {
            rafRef.current = null;
            return;
          }

          const cRect = c.getBoundingClientRect();
          const cy = currentRef.current.clientY - cRect.top;
          const cx = currentRef.current.clientX - cRect.left;

          let scrolled = false;
          if (cy < AUTO_SCROLL_ZONE) {
            c.scrollTop -= AUTO_SCROLL_SPEED;
            scrolled = true;
          } else if (cy > cRect.height - AUTO_SCROLL_ZONE) {
            c.scrollTop += AUTO_SCROLL_SPEED;
            scrolled = true;
          }
          if (cx < AUTO_SCROLL_ZONE) {
            c.scrollLeft -= AUTO_SCROLL_SPEED;
            scrolled = true;
          } else if (cx > cRect.width - AUTO_SCROLL_ZONE) {
            c.scrollLeft += AUTO_SCROLL_SPEED;
            scrolled = true;
          }

          if (scrolled) {
            const updatedRect = computeRect();
            if (updatedRect) setMarqueeRect(updatedRect);
          }

          rafRef.current = requestAnimationFrame(autoScroll);
        };
        rafRef.current = requestAnimationFrame(autoScroll);
      }
    };

    const handleMouseUp = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (stateRef.current === "active") {
        const rect = computeRect();
        if (rect) {
          const newSelections = computeSelection(rect);
          if (shiftRef.current) {
            const existing = useTimelineStore.getState().selectedWords;
            const merged = [...existing];
            for (const sel of newSelections) {
              const exists = merged.some(
                (w) => w.lineId === sel.lineId && w.wordIndex === sel.wordIndex && w.type === sel.type,
              );
              if (!exists) merged.push(sel);
            }
            useTimelineStore.getState().setSelectedWords(merged);
          } else {
            useTimelineStore.getState().setSelectedWords(newSelections);
          }
        }
      } else if (stateRef.current === "pending") {
        if (!shiftRef.current) {
          useTimelineStore.getState().clearSelection();
        }
      }

      stateRef.current = "idle";
      setMarqueeRect(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [scrollContainerRef, computeRect, computeSelection]);

  return { marqueeRect, handleMarqueeMouseDown };
}

// -- Exports -------------------------------------------------------------------

export { useMarquee };
export type { MarqueeRect };
