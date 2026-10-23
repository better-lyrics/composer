import { loopRegionLengthLabel, loopRegionRangeLabel } from "@/views/timeline/loop-region-copy";
import { shownLoopRegion, useTimelineStore } from "@/views/timeline/timeline-store";
import { IconMagnet } from "@tabler/icons-react";
import { createPortal } from "react-dom";

// -- Interfaces ----------------------------------------------------------------

interface LoopRegionReadoutProps {
  host: HTMLElement | null;
}

// -- Components ----------------------------------------------------------------

const LoopRegionReadout: React.FC<LoopRegionReadoutProps> = ({ host }) => {
  const region = useTimelineStore(shownLoopRegion);
  const drag = useTimelineStore((s) => s.loopRegionDrag);
  const zoom = useTimelineStore((s) => s.zoom);
  const scrollLeft = useTimelineStore((s) => s.scrollLeft);
  if (!host || !region || !drag) return null;
  return createPortal(
    <span
      data-loop-region-readout
      className="pointer-events-none absolute top-1 z-10 flex h-5 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md bg-(--pop) px-2 font-mono text-[11px] font-medium tabular-nums text-composer-text shadow-pop"
      style={{ left: ((region.begin + region.end) / 2) * zoom - scrollLeft }}
    >
      {loopRegionRangeLabel(region)}
      <span className="text-composer-text-muted">{`・ ${loopRegionLengthLabel(region)}`}</span>
      {drag.snappedTo && (
        <span className="flex items-center gap-0.5 font-sans text-composer-accent-text">
          <IconMagnet aria-hidden="true" className="size-3" />
          {drag.snappedTo}
        </span>
      )}
    </span>,
    host,
  );
};

// -- Exports -------------------------------------------------------------------

export { LoopRegionReadout };
