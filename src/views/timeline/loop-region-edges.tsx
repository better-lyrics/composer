import { startLoopRegionDrag } from "@/views/timeline/loop-region-drag";
import { type LoopRegionDrag, WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Constants -----------------------------------------------------------------

const EDGE_HIT_PX = 10;
const EDGE = "absolute top-0 z-20 cursor-ew-resize";

// -- Functions -----------------------------------------------------------------

function grabEdge(edge: LoopRegionDrag["edge"]) {
  return (event: React.MouseEvent<HTMLDivElement>) => {
    const container = event.currentTarget.closest<HTMLElement>("[data-scroll-container]");
    if (container) startLoopRegionDrag(event, container, edge);
  };
}

// -- Components ----------------------------------------------------------------

const LoopRegionEdges: React.FC = () => {
  const region = useTimelineStore((s) => s.loopRegion);
  const zoom = useTimelineStore((s) => s.zoom);
  if (!region) return null;
  const outer = EDGE_HIT_PX / 2;
  // On a narrow region each edge reaches only to the middle, so both stay grabbable.
  const inner = Math.min(outer, ((region.end - region.begin) * zoom) / 2);
  const zones = {
    begin: { left: region.begin * zoom - outer, width: outer + inner },
    end: { left: region.end * zoom - inner, width: inner + outer },
  };
  return (["begin", "end"] as const).map((edge) => (
    <div
      key={edge}
      data-loop-region-edge={edge}
      role="separator"
      aria-orientation="vertical"
      aria-hidden="true"
      className={EDGE}
      style={{ ...zones[edge], height: WAVEFORM_HEIGHT - 1 }}
      onMouseDown={grabEdge(edge)}
    />
  ));
};

// -- Exports -------------------------------------------------------------------

export { LoopRegionEdges };
