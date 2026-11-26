import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { getEffectiveLines } from "@/domain/line/effective-words";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import type { SyllableAddress } from "@/domain/selection/model";
import { addressOf } from "@/domain/selection/resolve";
import { mergeAddresses } from "@/domain/selection/set-ops";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { holdFrames } from "@/lib/frame-loop";
import { noteGuideSignal } from "@/lib/guide-signals";
import { swallowTrailingClick } from "@/lib/swallow-trailing-click";
import { useProjectStore } from "@/stores/project";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { currentOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { computeRowLayout } from "@/views/timeline/utils";
import { readViewScroll, scrollViewBy } from "@/views/timeline/view-scroll";

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
const AUTO_SCROLL_ZONE = 40;
const AUTO_SCROLL_SPEED = 8;
const AUTO_SCROLL_LABEL = "marquee-scroll";

// -- Hook ----------------------------------------------------------------------

function useMarquee(scrollContainerRef: RefObject<HTMLDivElement | null>) {
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const [autoScrolling, setAutoScrolling] = useState(false);
  const stateRef = useRef<MarqueeState>("idle");
  const laneOwnsClickRef = useRef(false);
  const startRef = useRef({ clientX: 0, clientY: 0, scrollLeft: 0, scrollTop: 0 });
  const currentRef = useRef({ clientX: 0, clientY: 0 });
  const shiftRef = useRef(false);

  const computeRect = useCallback((): MarqueeRect | null => {
    const container = scrollContainerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const start = startRef.current;
    const current = currentRef.current;

    const startX = start.clientX - containerRect.left + start.scrollLeft;
    const startY = start.clientY - containerRect.top + start.scrollTop;
    const { left, top } = readViewScroll(container);
    const currentX = current.clientX - containerRect.left + left;
    const currentY = current.clientY - containerRect.top + top;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    return { x, y, width, height };
  }, [scrollContainerRef]);

  const autoScroll = useCallback(() => {
    const c = scrollContainerRef.current;
    if (!c || stateRef.current !== "active") return;

    const cRect = c.getBoundingClientRect();
    const cy = currentRef.current.clientY - cRect.top;
    const cx = currentRef.current.clientX - cRect.left;

    const deltaTop =
      cy < AUTO_SCROLL_ZONE ? -AUTO_SCROLL_SPEED : cy > cRect.height - AUTO_SCROLL_ZONE ? AUTO_SCROLL_SPEED : 0;
    const deltaLeft =
      cx < AUTO_SCROLL_ZONE ? -AUTO_SCROLL_SPEED : cx > cRect.width - AUTO_SCROLL_ZONE ? AUTO_SCROLL_SPEED : 0;
    scrollViewBy(c, deltaLeft, deltaTop);

    if (deltaLeft !== 0 || deltaTop !== 0) {
      const updatedRect = computeRect();
      if (updatedRect) setMarqueeRect(updatedRect);
    }
  }, [scrollContainerRef, computeRect]);

  useFrameLoop(autoScroll, AUTO_SCROLL_LABEL, autoScrolling);

  // Edge auto-scroll must keep running while the pointer is held still, so hold
  // the loop awake and let effect cleanup guarantee the release.
  useEffect(() => (autoScrolling ? holdFrames(AUTO_SCROLL_LABEL) : undefined), [autoScrolling]);

  const computeSelection = useCallback((rect: MarqueeRect): SyllableAddress[] => {
    const lines = getEffectiveLines(useProjectStore.getState().lines);
    const { zoom, rowHeights, defaultRowHeight, collapsedInstances, focusedGroup } = useTimelineStore.getState();
    const layout = computeRowLayout({
      lines,
      rowHeights,
      defaultRowHeight,
      collapsedInstances,
      focusedGroup,
      waveformHeight: currentOverviewBandHeight(),
      groupHeaderHeight: GROUP_HEADER_HEIGHT,
    });

    const selections: SyllableAddress[] = [];
    const rectBottom = rect.y + rect.height;
    const rectRight = rect.x + rect.width;

    for (const line of lines) {
      const pos = layout.lineTops.get(line.id);
      if (!pos) continue;

      const mainHeight = rowHeights[line.id] ?? defaultRowHeight;
      const backgroundWords = timedSyllables(backgroundTrack(line));
      const mainTop = pos.top;
      const mainBottom = mainTop + mainHeight;

      if (mainTop < rectBottom && mainBottom > rect.y) {
        for (const word of timedSyllables(mainTrack(line))) {
          const wordLeft = GUTTER_WIDTH + word.begin * zoom;
          const wordRight = GUTTER_WIDTH + word.end * zoom;
          if (wordLeft < rectRight && wordRight > rect.x) selections.push(addressOf(line, "word", word));
        }
      }

      if (backgroundWords.length > 0) {
        const bgHeight = mainHeight;
        const bgTop = mainBottom;
        const bgBottom = bgTop + bgHeight;
        if (bgTop < rectBottom && bgBottom > rect.y) {
          for (const word of backgroundWords) {
            const wordLeft = GUTTER_WIDTH + word.begin * zoom;
            const wordRight = GUTTER_WIDTH + word.end * zoom;
            if (wordLeft < rectRight && wordRight > rect.x) selections.push(addressOf(line, "bg", word));
          }
        }
      }
    }

    return selections;
  }, []);

  const handleMarqueeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || e.defaultPrevented) return;

      const target = e.target as HTMLElement;
      if (target.closest("[data-word-block]")) return;

      const container = scrollContainerRef.current;
      if (!container) return;

      stateRef.current = "pending";
      shiftRef.current = e.shiftKey;
      laneOwnsClickRef.current = useTimelineStore.getState().stepTiming && target.closest("[data-word-track]") !== null;
      const { left, top } = readViewScroll(container);
      startRef.current = { clientX: e.clientX, clientY: e.clientY, scrollLeft: left, scrollTop: top };
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

      setAutoScrolling(true);
    };

    const handleMouseUp = () => {
      setAutoScrolling(false);

      if (stateRef.current === "active") {
        swallowTrailingClick();
        const rect = computeRect();
        if (rect) {
          const newSelections = computeSelection(rect);
          if (shiftRef.current) {
            const { stepQueue, selectedWords } = useTimelineStore.getState();
            const existing = stepQueue ?? selectedWords;
            useTimelineStore.getState().setSelectedWords(mergeAddresses(existing, newSelections));
          } else {
            useTimelineStore.getState().setSelectedWords(newSelections);
          }
          if (newSelections.length > 0)
            noteGuideSignal(newSelections.length > 1 ? "timeline.selectMore" : "timeline.select");
        }
      } else if (stateRef.current === "pending") {
        if (!shiftRef.current && !laneOwnsClickRef.current) {
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
    };
  }, [computeRect, computeSelection]);

  return { marqueeRect, handleMarqueeMouseDown };
}

// -- Exports -------------------------------------------------------------------

export type { MarqueeRect };
export { useMarquee };
