import { IconButton } from "@/ui/icon-button";
import { MAX_ZOOM, MIN_ZOOM, useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineZoom } from "@/views/timeline/use-timeline-zoom";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useRef } from "react";

const TimelineZoomControls: React.FC<{ scrollContainerRef?: React.RefObject<HTMLDivElement | null> }> = ({
  scrollContainerRef,
}) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const storeZoomIn = useTimelineStore((s) => s.zoomIn);
  const storeZoomOut = useTimelineStore((s) => s.zoomOut);
  const fallbackRef = useRef<HTMLDivElement | null>(null);
  const anchoredZoom = useTimelineZoom(scrollContainerRef ?? fallbackRef);
  const zoomIn = scrollContainerRef ? anchoredZoom.zoomIn : storeZoomIn;
  const zoomOut = scrollContainerRef ? anchoredZoom.zoomOut : storeZoomOut;

  const zoomPercent = Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100);
  return (
    <div className="tray">
      <IconButton
        label="Zoom out"
        icon={<IconMinus size={18} />}
        variant="ghost"
        onClick={zoomOut}
        disabled={zoom <= MIN_ZOOM}
        className="size-7 hover:bg-(--layer-2) hover:text-composer-text"
      />

      <span className="min-w-11 text-center font-mono text-xs text-composer-accent-text select-none tabular-nums">
        {zoomPercent}%
      </span>

      <IconButton
        label="Zoom in"
        icon={<IconPlus size={18} />}
        variant="ghost"
        onClick={zoomIn}
        disabled={zoom >= MAX_ZOOM}
        className="size-7 hover:bg-(--layer-2) hover:text-composer-text"
      />
    </div>
  );
};

export { TimelineZoomControls };
