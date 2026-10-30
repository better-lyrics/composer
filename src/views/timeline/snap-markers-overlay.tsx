import { snapPointTimes } from "@/domain/snap-point/model";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useBandEmpty } from "@/views/timeline/band-empty";
import { useOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { computeCoveredOnsets, isTimeOnOnset } from "@/views/timeline/snap-marker-math";
import { SnapMarkerPin } from "@/views/timeline/snap-marker-pin";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useSnapMarkerDrag } from "@/views/timeline/use-snap-marker-drag";
import { AnimatePresence } from "motion/react";
import { useMemo, useRef } from "react";

// -- Types ---------------------------------------------------------------------

interface SnapMarkersOverlayProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  headHost: HTMLElement | null;
}

// -- Constants -----------------------------------------------------------------

const ONSET_STAGGER_STEP_MS = 24;
const ONSET_STAGGER_CAP_MS = 900;

// -- Helpers -------------------------------------------------------------------

// Module-scope so its identity is stable across renders, otherwise a fresh
// closure per pin would defeat SnapMarkerPin's memo and re-render every pin on
// each drag frame.
function handleSnapPinHoverChange(id: string, hovering: boolean): void {
  const store = useTimelineStore.getState();
  if (hovering) store.setHoveredSnapPointId(id);
  else if (store.hoveredSnapPointId === id) store.setHoveredSnapPointId(null);
}

// -- Component -----------------------------------------------------------------

const SnapMarkersOverlay: React.FC<SnapMarkersOverlayProps> = ({ scrollContainerRef, headHost }) => {
  const bandHeight = useOverviewBandHeight();
  const zoom = useTimelineStore((s) => s.zoom);
  const vocalOnsetSnapPoints = useTimelineStore((s) => s.vocalOnsetSnapPoints);
  const customSnapPoints = useProjectStore((s) => s.customSnapPoints);
  const removeCustomSnapPoint = useProjectStore((s) => s.removeCustomSnapPoint);
  const markerMode = useTimelineStore((s) => s.markerMode);
  const showOnsets = useSettingsStore((s) => s.vocalOnsetSnap);
  const thresholdPx = useSettingsStore((s) => s.snapDistanceOnsets);

  const { draggingId, draggingTime, onHeadPointerDown } = useSnapMarkerDrag({ scrollContainerRef });

  const coveredOnsets = useMemo(() => {
    if (!showOnsets) return new Set<number>();
    const coveringTimes =
      draggingTime === null ? snapPointTimes(customSnapPoints) : [...snapPointTimes(customSnapPoints), draggingTime];
    return computeCoveredOnsets(vocalOnsetSnapPoints, coveringTimes, zoom, thresholdPx);
  }, [showOnsets, vocalOnsetSnapPoints, customSnapPoints, draggingTime, zoom, thresholdPx]);

  const layerRef = useRef<HTMLDivElement>(null);

  const visibleOnsetCount = showOnsets ? vocalOnsetSnapPoints.length : 0;
  // An unmounted pin never gets its pointerup, so the drag would not commit.
  const hiddenWhileLoading = useBandEmpty() && draggingId === null;
  const isVisible = !hiddenWhileLoading && (visibleOnsetCount > 0 || customSnapPoints.length > 0 || markerMode);

  useFrameLoop(
    () => {
      const layer = layerRef.current;
      if (layer) {
        const scrollLeft = scrollContainerRef.current?.scrollLeft ?? useTimelineStore.getState().scrollLeft;
        layer.style.transform = `translate3d(${GUTTER_WIDTH - scrollLeft}px, 0, 0)`;
      }
    },
    "snap-markers-overlay",
    isVisible,
  );

  if (!isVisible) return null;

  return (
    <div
      data-snap-markers-overlay
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-40"
      style={{ clipPath: `inset(0 0 calc(100% - ${bandHeight - 1}px) ${GUTTER_WIDTH}px)` }}
    >
      <div
        ref={layerRef}
        data-snap-markers-layer
        className="absolute inset-0 pointer-events-none"
        style={{ transform: `translate3d(${GUTTER_WIDTH}px, 0, 0)` }}
      >
        {showOnsets && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {vocalOnsetSnapPoints.map((time, index) => (
              <div
                key={`${time}-${index}`}
                data-snap-marker="onset"
                data-covered={coveredOnsets.has(index) ? "" : undefined}
                className={`snap-onset-line snap-onset-enter absolute top-0 -translate-x-1/2 pointer-events-none ${
                  coveredOnsets.has(index) ? "snap-onset-covered" : ""
                }`}
                style={{
                  left: time * zoom,
                  height: bandHeight,
                  animationDelay: `${Math.min(index * ONSET_STAGGER_STEP_MS, ONSET_STAGGER_CAP_MS)}ms`,
                }}
              />
            ))}
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none z-20">
          <AnimatePresence>
            {customSnapPoints.map((point) => (
              <SnapMarkerPin
                key={point.id}
                id={point.id}
                time={point.time}
                zoom={zoom}
                fadeExtent={bandHeight}
                headHost={headHost}
                isDragging={draggingId === point.id}
                isOnOnset={showOnsets && isTimeOnOnset(point.time, vocalOnsetSnapPoints, zoom, thresholdPx)}
                onHeadPointerDown={onHeadPointerDown}
                onDelete={removeCustomSnapPoint}
                onHoverChange={handleSnapPinHoverChange}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SnapMarkersOverlay };
