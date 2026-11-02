import type { SyncGranularity } from "@/domain/line/sync-progress";
import { cn } from "@/utils/cn";
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
  ring: RippleTarget | null;
  onRingDone: () => void;
  aboveCurrent?: React.ReactNode;
}

type RowRef = (element: HTMLElement | null) => void;

// -- Constants ----------------------------------------------------------------

const ANCHOR_HEIGHT_RATIO = 1 / 2;

// -- Functions ----------------------------------------------------------------

function rowPresenceClass(distance: number): string {
  if (distance === 0) return "opacity-100";
  return Math.abs(distance) === 1 ? "opacity-40 scale-65" : "opacity-0 scale-65";
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
  ring,
  onRingDone,
  aboveCurrent,
}) => {
  const reducedMotion = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rowElements = useRef(new Map<number, HTMLElement>());
  const rowRefs = useRef(new Map<number, RowRef>());
  const anchorLineIndex = useRef<number | null>(null);

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
    const y = host.clientHeight * ANCHOR_HEIGHT_RATIO - rowCentre(anchor);
    track.style.transform = `translate3d(0, ${y}px, 0)`;
  }, []);

  useLayoutEffect(() => {
    anchorLineIndex.current = visibleRows[anchorVisibleIndex]?.lineIndex ?? null;
    place();
  }, [visibleRows, anchorVisibleIndex, place]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(place);
    observer.observe(host);
    return () => observer.disconnect();
  }, [place]);

  return (
    <div ref={hostRef} className="relative flex-1 min-h-0 w-full overflow-hidden px-16">
      <div
        ref={trackRef}
        className="relative mx-auto flex max-w-240 flex-col gap-6.5 px-3 transition-transform duration-220 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
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
                ring={ring?.lineId === row.line.id ? laneRing : null}
                onRingDone={onRingDone}
                aboveCurrent={aboveCurrent}
                className={cn(
                  "transition-[opacity,scale] duration-220 ease-out motion-reduce:transition-none",
                  rowPresenceClass(distance),
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
