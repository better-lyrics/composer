import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";
import { MAX_ZOOM, MIN_ZOOM, useTimelineStore } from "@/views/timeline/timeline-store";
import { IconEye, IconFocusCentered, IconMinus, IconPlus } from "@tabler/icons-react";

// -- Component -----------------------------------------------------------------

const TimelineHeader: React.FC = () => {
  const zoom = useTimelineStore((s) => s.zoom);
  const zoomIn = useTimelineStore((s) => s.zoomIn);
  const zoomOut = useTimelineStore((s) => s.zoomOut);
  const followEnabled = useTimelineStore((s) => s.followEnabled);
  const toggleFollow = useTimelineStore((s) => s.toggleFollow);
  const previewSidebarOpen = useTimelineStore((s) => s.previewSidebarOpen);
  const togglePreviewSidebar = useTimelineStore((s) => s.togglePreviewSidebar);

  const zoomPercent = Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100);

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-composer-border">
      <h2 className="text-lg font-medium select-none">Timeline</h2>

      <div className="flex items-center gap-4">
        {/* Follow toggle */}
        <Button
          variant={followEnabled ? "primary" : "ghost"}
          size="sm"
          onClick={toggleFollow}
          hasIcon
          className={cn(!followEnabled && "opacity-60")}
        >
          <IconFocusCentered size={16} />
          <span>Follow</span>
        </Button>

        {/* Preview sidebar toggle */}
        <Button
          variant={previewSidebarOpen ? "primary" : "ghost"}
          size="sm"
          onClick={togglePreviewSidebar}
          hasIcon
          className={cn(!previewSidebarOpen && "opacity-60")}
        >
          <IconEye size={16} />
          <span>Preview</span>
        </Button>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={zoomOut} disabled={zoom <= MIN_ZOOM} className="h-7 w-7">
            <IconMinus size={16} />
          </Button>

          <span className="w-12 text-center text-xs text-composer-text-muted select-none tabular-nums">
            {zoomPercent}%
          </span>

          <Button variant="ghost" size="icon" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} className="h-7 w-7">
            <IconPlus size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineHeader };
