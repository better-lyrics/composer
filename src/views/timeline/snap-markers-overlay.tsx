import { AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { snapPointTimes } from "@/domain/snap-point/model";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { SnapMarkerPin } from "@/views/timeline/snap-marker-pin";
import { computeCoveredOnsets, isTimeOnOnset } from "@/views/timeline/snap-marker-math";
import { useSnapMarkerDrag } from "@/views/timeline/use-snap-marker-drag";
import { GUTTER_WIDTH, useTimelineStore, WAVEFORM_HEIGHT } from "@/views/timeline/timeline-store";

// -- Types ---------------------------------------------------------------------

interface SnapMarkersOverlayProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// -- Constants -----------------------------------------------------------------

const ONSET_STAGGER_STEP_MS = 24;
const ONSET_STAGGER_CAP_MS = 900;

// -- Component -----------------------------------------------------------------

const SnapMarkersOverlay: React.FC<SnapMarkersOverlayProps> = ({ scrollContainerRef }) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const vocalOnsetSnapPoints = useTimelineStore((s) => s.vocalOnsetSnapPoints);
  const customSnapPoints = useProjectStore((s) => s.customSnapPoints);
  const removeCustomSnapPoint = useProjectStore((s) => s.removeCustomSnapPoint);
  const markerMode = useTimelineStore((s) => s.markerMode);
  const showOnsets = useSettingsStore((s) => s.vocalOnsetSnap);
  const thresholdPx = useSettingsStore((s) => s.timelineSnapThreshold);

  const { draggingId, draggingTime, onHeadPointerDown } = useSnapMarkerDrag({ scrollContainerRef });

  const coveredOnsets = useMemo(() => {
    if (!showOnsets) return new Set<number>();
    const coveringTimes =
      draggingTime === null ? snapPointTimes(customSnapPoints) : [...snapPointTimes(customSnapPoints), draggingTime];
    return computeCoveredOnsets(vocalOnsetSnapPoints, coveringTimes, zoom, thresholdPx);
  }, [showOnsets, vocalOnsetSnapPoints, customSnapPoints, draggingTime, zoom, thresholdPx]);

  const layerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const applyTransform = () => {
      const layer = layerRef.current;
      if (layer) {
        const scrollLeft = scrollContainerRef.current?.scrollLeft ?? useTimelineStore.getState().scrollLeft;
        layer.style.transform = `translate3d(${GUTTER_WIDTH - scrollLeft}px, 0, 0)`;
      }
      rafRef.current = requestAnimationFrame(applyTransform);
    };

    applyTransform();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollContainerRef]);

  const visibleOnsetCount = showOnsets ? vocalOnsetSnapPoints.length : 0;
  if (visibleOnsetCount === 0 && customSnapPoints.length === 0 && !markerMode) return null;

  return (
    <div
      data-snap-markers-overlay
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-40"
      style={{ clipPath: `inset(0 0 0 ${GUTTER_WIDTH}px)` }}
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
                // biome-ignore lint/suspicious/noArrayIndexKey: index tiebreaks identical onset times
                key={`${time}-${index}`}
                data-snap-marker="onset"
                data-covered={coveredOnsets.has(index) ? "" : undefined}
                className={`snap-onset-line snap-onset-enter absolute top-0 -translate-x-1/2 pointer-events-none ${
                  coveredOnsets.has(index) ? "snap-onset-covered" : ""
                }`}
                style={{
                  left: time * zoom,
                  height: WAVEFORM_HEIGHT,
                  animationDelay: `${Math.min(index * ONSET_STAGGER_STEP_MS, ONSET_STAGGER_CAP_MS)}ms`,
                }}
              />
            ))}
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none z-20">
          <AnimatePresence initial={false}>
            {customSnapPoints.map((point) => (
              <SnapMarkerPin
                key={point.id}
                id={point.id}
                time={point.time}
                zoom={zoom}
                fadeExtent={WAVEFORM_HEIGHT}
                isDragging={draggingId === point.id}
                isOnOnset={showOnsets && isTimeOnOnset(point.time, vocalOnsetSnapPoints, zoom, thresholdPx)}
                onHeadPointerDown={onHeadPointerDown}
                onDelete={removeCustomSnapPoint}
                onHoverChange={(hovering) => {
                  const store = useTimelineStore.getState();
                  if (hovering) store.setHoveredSnapPointId(point.id);
                  else if (store.hoveredSnapPointId === point.id) store.setHoveredSnapPointId(null);
                }}
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
