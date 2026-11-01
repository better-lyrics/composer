import type { SyncGranularity } from "@/domain/line/sync-progress";
import { cn } from "@/utils/cn";
import type { LaneClickTarget } from "@/views/sync/lane-click-target";
import type { LaneRow } from "@/views/sync/lane-rows";
import { type LaneRing, SyncLaneLine } from "@/views/sync/sync-lane-line";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";

// -- Interfaces ---------------------------------------------------------------

interface RippleTarget {
  lineId: string;
  wordIndex: number;
  nonce: number;
}

interface SyncLaneProps {
  rows: LaneRow[];
  lineIndex: number;
  wordIndex: number;
  granularity: SyncGranularity;
  isHolding: boolean;
  placingLineIndex: number | null;
  paused: boolean;
  ring: RippleTarget | null;
  onRingDone: () => void;
  onJump: (lineIndex: number, target: NonNullable<LaneClickTarget>) => void;
  aboveCurrent?: React.ReactNode;
}

type RowRef = (element: HTMLElement | null) => void;

// -- Constants ----------------------------------------------------------------

const OPACITY_PERCENT_BY_DISTANCE: Record<number, number> = {
  [-2]: 20,
  [-1]: 40,
  0: 100,
  1: 60,
  2: 42,
  3: 30,
  4: 22,
};

const OPACITY_CLASS_BY_PERCENT: Record<number, string> = {
  0: "opacity-0",
  15: "opacity-15",
  20: "opacity-20",
  22: "opacity-22",
  30: "opacity-30",
  40: "opacity-40",
  42: "opacity-42",
  45: "opacity-45",
  60: "opacity-60",
  100: "opacity-100",
};

const FAR_AHEAD_OPACITY_PERCENT = 15;
const FAR_BEHIND_DISTANCE = -2;
const PAUSED_MIN_OPACITY_PERCENT = 45;
const PAUSED_LIFT_MIN_DISTANCE = -6;
const PAUSED_LIFT_MAX_DISTANCE = 8;
const ANCHOR_HEIGHT_RATIO = 1 / 3;

// -- Functions ----------------------------------------------------------------

function rowOpacityClass(distance: number, paused: boolean): string {
  const percent =
    OPACITY_PERCENT_BY_DISTANCE[distance] ?? (distance < FAR_BEHIND_DISTANCE ? 0 : FAR_AHEAD_OPACITY_PERCENT);
  const liftsWhilePaused = paused && distance >= PAUSED_LIFT_MIN_DISTANCE && distance <= PAUSED_LIFT_MAX_DISTANCE;
  return OPACITY_CLASS_BY_PERCENT[liftsWhilePaused ? Math.max(percent, PAUSED_MIN_OPACITY_PERCENT) : percent];
}

function rowCentre(element: HTMLElement): number {
  return element.offsetTop + element.offsetHeight / 2;
}

// -- Components ---------------------------------------------------------------

const SyncLane: React.FC<SyncLaneProps> = ({
  rows,
  lineIndex,
  wordIndex,
  granularity,
  isHolding,
  placingLineIndex,
  paused,
  ring,
  onRingDone,
  onJump,
  aboveCurrent,
}) => {
  const reducedMotion = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rowElements = useRef(new Map<number, HTMLElement>());
  const rowRefs = useRef(new Map<number, RowRef>());
  const anchorLineIndex = useRef<number | null>(null);
  const scrollOffset = useRef(0);
  const previous = useRef({ lineIndex, paused });

  const visibleRows = useMemo(() => rows.filter((row) => !row.folded), [rows]);
  const anchorVisibleIndex = useMemo(() => {
    const atOrAfter = visibleRows.findIndex((row) => row.lineIndex >= lineIndex);
    return atOrAfter === -1 ? visibleRows.length - 1 : atOrAfter;
  }, [visibleRows, lineIndex]);

  const laneRing = useMemo<LaneRing | null>(
    () => (ring && reducedMotion !== true ? { wordIndex: ring.wordIndex, nonce: ring.nonce } : null),
    [ring, reducedMotion],
  );

  const rowRef = useCallback((rowLineIndex: number): RowRef => {
    const cached = rowRefs.current.get(rowLineIndex);
    if (cached) return cached;
    const ref: RowRef = (element) => {
      if (element) rowElements.current.set(rowLineIndex, element);
      else rowElements.current.delete(rowLineIndex);
    };
    rowRefs.current.set(rowLineIndex, ref);
    return ref;
  }, []);

  const place = useCallback(() => {
    const host = hostRef.current;
    const track = trackRef.current;
    const anchor = anchorLineIndex.current === null ? undefined : rowElements.current.get(anchorLineIndex.current);
    if (!host || !track || !anchor) return;
    const y = host.clientHeight * ANCHOR_HEIGHT_RATIO - rowCentre(anchor) + scrollOffset.current;
    track.style.transform = `translate3d(0, ${y}px, 0)`;
  }, []);

  useLayoutEffect(() => {
    if (previous.current.lineIndex !== lineIndex || previous.current.paused !== paused) {
      scrollOffset.current = 0;
      previous.current = { lineIndex, paused };
    }
    anchorLineIndex.current = visibleRows[anchorVisibleIndex]?.lineIndex ?? null;
    place();
  }, [lineIndex, paused, visibleRows, anchorVisibleIndex, place]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(place);
    observer.observe(host);
    return () => observer.disconnect();
  }, [place]);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const first = visibleRows[0];
    const last = visibleRows.at(-1);
    const firstElement = first && rowElements.current.get(first.lineIndex);
    const lastElement = last && rowElements.current.get(last.lineIndex);
    const anchor = anchorLineIndex.current === null ? undefined : rowElements.current.get(anchorLineIndex.current);
    if (!firstElement || !lastElement || !anchor) return;
    const centre = rowCentre(anchor);
    const minOffset = centre - rowCentre(lastElement);
    const maxOffset = centre - rowCentre(firstElement);
    scrollOffset.current = Math.min(Math.max(scrollOffset.current - event.deltaY, minOffset), maxOffset);
    place();
  };

  return (
    <div
      ref={hostRef}
      className="relative flex-1 min-h-0 w-full overflow-hidden px-16"
      onWheel={paused ? handleWheel : undefined}
    >
      <div
        ref={trackRef}
        className="relative mx-auto flex max-w-240 flex-col gap-6.5 px-3 transition-transform duration-220 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform motion-reduce:transition-none"
      >
        {visibleRows.map((row, visibleIndex) => {
          const distance = visibleIndex - anchorVisibleIndex;
          return (
            <div key={row.line.id} ref={rowRef(row.lineIndex)} className="flex flex-col">
              <SyncLaneLine
                row={row}
                isCurrent={row.lineIndex === lineIndex}
                isLastLine={row.lineIndex === lineIndex - 1}
                wordIndex={wordIndex}
                granularity={granularity}
                isHolding={isHolding}
                isPlacing={row.lineIndex === placingLineIndex}
                paused={paused}
                ring={ring?.lineId === row.line.id ? laneRing : null}
                onRingDone={onRingDone}
                onJump={onJump}
                aboveCurrent={aboveCurrent}
                className={cn(
                  "transition-[opacity,scale] ease-out motion-reduce:transition-none",
                  paused ? "duration-150" : "duration-220",
                  rowOpacityClass(distance, paused),
                  distance < 0 && "scale-[0.82]",
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyncLane };
export type { RippleTarget };
