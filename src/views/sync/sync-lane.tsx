import type { SyncGranularity } from "@/domain/line/sync-progress";
import { cn } from "@/utils/cn";
import type { LaneRow } from "@/views/sync/lane-rows";
import { heightAboveWindow, laneMove, laneWindow } from "@/views/sync/lane-window";
import { type LaneRing, SyncLaneLine } from "@/views/sync/sync-lane-line";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef } from "react";

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

interface PlacedAnchor {
  visibleIndex: number;
  lineIndex: number;
  centre: number;
}

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

function anchoredTrackY(host: HTMLElement, anchor: HTMLElement): number {
  return host.clientHeight * ANCHOR_HEIGHT_RATIO - rowCentre(anchor);
}

function setTrackY(track: HTMLElement, y: number) {
  track.style.transform = `translate3d(0, ${y}px, 0)`;
}

function animatedTrackY(track: HTMLElement): number {
  return new DOMMatrixReadOnly(getComputedStyle(track).transform).m42;
}

// Reading the style commits the new transform as the start of the next transition, so nothing slides into it.
function jumpTrack(track: HTMLElement, y: number) {
  track.style.transition = "none";
  setTrackY(track, y);
  getComputedStyle(track).transform;
  track.style.transition = "";
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
  const spacerRef = useRef<HTMLDivElement>(null);
  const rowHeights = useRef(new Map<string, number>());
  const rowElements = useRef(new Map<number, HTMLElement>());
  const rowRefs = useRef(new Map<number, RowRef>());

  const visibleRows = useMemo(() => rows.filter((row) => !row.folded), [rows]);
  const anchorVisibleIndex = useMemo(() => {
    const atOrAfter = visibleRows.findIndex((row) => row.lineIndex >= lineIndex);
    return atOrAfter === -1 ? visibleRows.length - 1 : atOrAfter;
  }, [visibleRows, lineIndex]);
  const { start: windowStart, end: windowEnd } = laneWindow(anchorVisibleIndex, visibleRows.length);

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

  const placedAnchor = useRef<PlacedAnchor | null>(null);

  const measureRows = useCallback(() => {
    for (const row of visibleRows.slice(windowStart, windowEnd)) {
      const height = rowElements.current.get(row.lineIndex)?.offsetHeight;
      if (height) rowHeights.current.set(row.line.id, height);
    }
  }, [visibleRows, windowStart, windowEnd]);

  const sizeSpacer = useCallback(() => {
    const track = trackRef.current;
    const spacer = spacerRef.current;
    if (!track || !spacer) return;
    const aboveIds = visibleRows.slice(0, windowStart).map((row) => row.line.id);
    const gap = Number.parseFloat(getComputedStyle(track).rowGap) || 0;
    spacer.style.height = `${heightAboveWindow(aboveIds, rowHeights.current, gap)}px`;
  }, [visibleRows, windowStart]);

  // A glide starts where the lane is now, shifted by however far the rows above moved when the window was re-laid out.
  useLayoutEffect(() => {
    const host = hostRef.current;
    const track = trackRef.current;
    const anchorRow = visibleRows[anchorVisibleIndex];
    measureRows();
    sizeSpacer();
    const anchor = anchorRow && rowElements.current.get(anchorRow.lineIndex);
    if (!host || !track || !anchor) return;
    const previous = placedAnchor.current;
    const previousAnchor = previous && rowElements.current.get(previous.lineIndex);
    const target = anchoredTrackY(host, anchor);
    if (previousAnchor && laneMove(previous.visibleIndex, anchorVisibleIndex) === "glide") {
      const shift = rowCentre(previousAnchor) - previous.centre;
      if (shift !== 0) jumpTrack(track, animatedTrackY(track) - shift);
      setTrackY(track, target);
    } else {
      jumpTrack(track, target);
    }
    placedAnchor.current = {
      visibleIndex: anchorVisibleIndex,
      lineIndex: anchorRow.lineIndex,
      centre: rowCentre(anchor),
    };
  }, [visibleRows, anchorVisibleIndex, measureRows, sizeSpacer]);

  const followResize = useEffectEvent((widthChanged: boolean) => {
    const host = hostRef.current;
    const track = trackRef.current;
    const placed = placedAnchor.current;
    const anchor = placed && rowElements.current.get(placed.lineIndex);
    if (widthChanged) {
      rowHeights.current.clear();
      measureRows();
      sizeSpacer();
    }
    if (!host || !track || !placed || !anchor) return;
    setTrackY(track, anchoredTrackY(host, anchor));
    placed.centre = rowCentre(anchor);
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let width = host.clientWidth;
    const observer = new ResizeObserver(() => {
      const widthChanged = host.clientWidth !== width;
      width = host.clientWidth;
      followResize(widthChanged);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="relative flex-1 min-h-0 w-full overflow-hidden px-16">
      <div
        ref={trackRef}
        className="relative mx-auto flex max-w-240 flex-col gap-6.5 px-3 transition-transform duration-220 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
      >
        {windowStart > 0 && <div ref={spacerRef} aria-hidden />}
        {visibleRows.slice(windowStart, windowEnd).map((row, offset) => {
          const distance = windowStart + offset - anchorVisibleIndex;
          const isCurrent = row.lineIndex === lineIndex;
          return (
            <div key={row.line.id} ref={rowRef(row.lineIndex)} className="flex flex-col">
              <SyncLaneLine
                row={row}
                isCurrent={isCurrent}
                isLastLine={row.lineIndex === lineIndex - 1}
                wordIndex={wordIndex}
                granularity={granularity}
                isHolding={isHolding}
                isPlacing={row.lineIndex === placingLineIndex}
                ring={ring?.lineId === row.line.id ? laneRing : null}
                onRingDone={onRingDone}
                aboveCurrent={isCurrent ? aboveCurrent : undefined}
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
