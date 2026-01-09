import { Button } from "@/ui/button";
import { useTimelineStore, MIN_ZOOM, MAX_ZOOM } from "@/views/timeline/timeline-store";
import { IconMinus, IconPlus, IconArrowsHorizontal } from "@tabler/icons-react";
import { cn } from "@/utils/cn";

// -- Component -----------------------------------------------------------------

const TimelineHeader: React.FC = () => {
  const zoom = useTimelineStore((s) => s.zoom);
  const zoomIn = useTimelineStore((s) => s.zoomIn);
  const zoomOut = useTimelineStore((s) => s.zoomOut);
  const rippleEnabled = useTimelineStore((s) => s.rippleEnabled);
  const toggleRipple = useTimelineStore((s) => s.toggleRipple);

  const zoomPercent = Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100);

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-composer-border">
      <h2 className="text-lg font-medium select-none">Timeline</h2>

      <div className="flex items-center gap-4">
        {/* Ripple toggle */}
        <Button
          variant={rippleEnabled ? "primary" : "ghost"}
          size="sm"
          onClick={toggleRipple}
          hasIcon
          className={cn(!rippleEnabled && "opacity-60")}
        >
          <IconArrowsHorizontal size={16} />
          <span>Ripple</span>
        </Button>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="h-7 w-7"
          >
            <IconMinus size={16} />
          </Button>

          <span className="w-12 text-center text-xs text-composer-text-muted select-none tabular-nums">
            {zoomPercent}%
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="h-7 w-7"
          >
            <IconPlus size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineHeader };
