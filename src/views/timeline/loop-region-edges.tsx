import { startLoopRegionDrag } from "@/views/timeline/loop-region-drag";
import { type LoopRegionDrag, WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Constants -----------------------------------------------------------------

const EDGE_HIT_PX = 10;
const EDGE = "absolute top-0 z-20 cursor-ew-resize";
const EDGE_LABEL: Record<LoopRegionDrag["edge"], string> = { begin: "Loop region start", end: "Loop region end" };

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
  return (["begin", "end"] as const).map((edge) => (
    <div
      key={edge}
      data-loop-region-edge={edge}
      role="separator"
      aria-orientation="vertical"
      aria-label={EDGE_LABEL[edge]}
      className={EDGE}
      style={{ left: region[edge] * zoom - EDGE_HIT_PX / 2, width: EDGE_HIT_PX, height: WAVEFORM_HEIGHT - 1 }}
      onMouseDown={grabEdge(edge)}
    />
  ));
};

// -- Exports -------------------------------------------------------------------

export { LoopRegionEdges };
