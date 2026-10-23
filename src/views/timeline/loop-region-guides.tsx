import { GUTTER_WIDTH, WAVEFORM_HEIGHT, shownLoopRegion, useTimelineStore } from "@/views/timeline/timeline-store";
import { useFollowHorizontalScroll } from "@/views/timeline/use-follow-horizontal-scroll";
import { useRef } from "react";

// -- Interfaces ----------------------------------------------------------------

interface LoopRegionGuidesProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// -- Constants -----------------------------------------------------------------

const GUIDE =
  "absolute inset-y-0 w-0 border-l border-dashed border-[color-mix(in_oklab,var(--color-composer-accent)_55%,transparent)]";

// -- Components ----------------------------------------------------------------

// Each guide sits on the outer side of its edge, matching the shade borders above it.
const LoopRegionGuides: React.FC<LoopRegionGuidesProps> = ({ scrollContainerRef }) => {
  const region = useTimelineStore(shownLoopRegion);
  const zoom = useTimelineStore((s) => s.zoom);
  const trackRef = useRef<HTMLDivElement>(null);
  useFollowHorizontalScroll(scrollContainerRef, trackRef, region !== null);
  if (!region) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-45 overflow-hidden"
      style={{ top: WAVEFORM_HEIGHT, clipPath: `inset(0 0 0 ${GUTTER_WIDTH}px)` }}
    >
      <div ref={trackRef} className="absolute inset-y-0" style={{ left: GUTTER_WIDTH }}>
        <div data-loop-region-guide="begin" className={GUIDE} style={{ left: region.begin * zoom - 1 }} />
        <div data-loop-region-guide="end" className={GUIDE} style={{ left: region.end * zoom }} />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { LoopRegionGuides };
