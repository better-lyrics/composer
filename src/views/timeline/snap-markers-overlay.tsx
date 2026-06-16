import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/stores/settings";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types ---------------------------------------------------------------------

interface SnapMarkersOverlayProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// -- Constants -----------------------------------------------------------------

const MARKER_FADE_EXTENT = 220;

// -- Component -----------------------------------------------------------------

const SnapMarkersOverlay: React.FC<SnapMarkersOverlayProps> = ({ scrollContainerRef }) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const vocalOnsetSnapPoints = useTimelineStore((s) => s.vocalOnsetSnapPoints);
  const showOnsets = useSettingsStore((s) => s.vocalOnsetSnap);

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
                className="snap-onset-line absolute top-0 pointer-events-none"
                style={{ left: time * zoom, height: MARKER_FADE_EXTENT }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SnapMarkersOverlay, MARKER_FADE_EXTENT };
