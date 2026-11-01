import { GUTTER_WIDTH, timeToX } from "@/views/timeline/coords";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Component ----------------------------------------------------------------

const SnapGuidelineAt: React.FC<{ time: number }> = ({ time }) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const scrollLeft = useTimelineStore((s) => s.scrollLeft);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-40"
      style={{ clipPath: `inset(0 0 0 ${GUTTER_WIDTH}px)` }}
    >
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left: timeToX(time, zoom, scrollLeft),
          width: 0,
          borderLeft: "1px dashed color-mix(in srgb, var(--color-composer-snap) 70%, transparent)",
        }}
      />
    </div>
  );
};

const SnapGuideline: React.FC = () => {
  const snappedAnchorTime = useTimelineStore((s) => s.snappedAnchorTime);
  return snappedAnchorTime === null ? null : <SnapGuidelineAt time={snappedAnchorTime} />;
};

// -- Exports ------------------------------------------------------------------

export { SnapGuideline, SnapGuidelineAt };
