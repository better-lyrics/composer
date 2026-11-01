import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { MarqueeRect } from "@/views/timeline/use-marquee";
import { viewScrollLeft, viewScrollTop } from "@/views/timeline/view-scroll";

// -- Types ---------------------------------------------------------------------

interface MarqueeSelectionProps {
  rect: MarqueeRect;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// -- Component -----------------------------------------------------------------

const MarqueeSelection: React.FC<MarqueeSelectionProps> = ({ rect, scrollContainerRef }) => {
  // Zoom moves the scroll position this box is placed against.
  useTimelineStore((s) => s.zoom);
  const container = scrollContainerRef.current;
  if (!container) return null;

  return (
    <div
      className="absolute pointer-events-none z-35 border border-dashed border-composer-accent bg-composer-accent/10 rounded-lg"
      style={{
        left: rect.x - viewScrollLeft(),
        top: rect.y - viewScrollTop(),
        width: rect.width,
        height: rect.height,
      }}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { MarqueeSelection };
