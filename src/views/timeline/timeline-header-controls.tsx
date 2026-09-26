import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { cn } from "@/utils/cn";
import { MAX_ZOOM, MIN_ZOOM, useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineZoom } from "@/views/timeline/use-timeline-zoom";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useRef } from "react";

interface TimelineToggleButtonProps {
  active: boolean;
  label: string;
  shortcut: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  className?: string;
}

const TimelineToggleButton: React.FC<TimelineToggleButtonProps> = ({
  active,
  label,
  shortcut,
  onClick,
  children,
  disabled,
  title,
  className,
}) => {
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  return (
    <Button
      variant={active ? "primary" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      hasIcon
      className={cn(!active && "opacity-60", className)}
      title={title}
    >
      {children}
      <span>{label}</span>
      {showHints && <InlineKeyBadge keys={getEffectiveKeysArray(shortcut)} />}
    </Button>
  );
};

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
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={zoomOut}
        disabled={zoom <= MIN_ZOOM}
        className="size-7"
        title="Zoom out"
        aria-label="Zoom out"
      >
        <IconMinus size={16} />
      </Button>

      <span className="w-12 text-center text-xs text-composer-text-muted select-none tabular-nums">{zoomPercent}%</span>

      <Button
        variant="ghost"
        size="icon"
        onClick={zoomIn}
        disabled={zoom >= MAX_ZOOM}
        className="size-7"
        title="Zoom in"
        aria-label="Zoom in"
      >
        <IconPlus size={16} />
      </Button>
    </div>
  );
};

export { TimelineToggleButton, TimelineZoomControls };
