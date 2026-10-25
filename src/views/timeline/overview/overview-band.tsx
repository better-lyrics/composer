import { useOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { BandViewport } from "@/views/timeline/overview/band-viewport";
import { useBandResize } from "@/views/timeline/overview/use-band-resize";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { Activity, type ReactNode } from "react";

// -- Interfaces ----------------------------------------------------------------

interface OverviewBandProps {
  children: ReactNode;
}

// -- Constants -----------------------------------------------------------------

const BAND_CLASS =
  "group/band sticky ml-12 top-0 z-40 bg-(--well) w-max motion-safe:transition-[min-height] motion-safe:duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] [[data-overview-resizing]_&]:transition-none";

const RESIZE_HANDLE_CLASS =
  "pointer-events-auto absolute inset-x-0 -bottom-1 h-[9px] cursor-ns-resize after:absolute after:top-[3px] after:left-1/2 after:-ml-[18px] after:h-[3px] after:w-9 after:rounded-[2px] after:bg-(--edge-strong) after:opacity-0 after:transition-opacity after:duration-150 after:ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/band:after:opacity-100 [[data-overview-resizing]_&]:after:bg-composer-accent [[data-overview-resizing]_&]:after:opacity-100";

// -- Components ----------------------------------------------------------------

const BandResizeHandle: React.FC = () => {
  const { onPointerDown, onDoubleClick } = useBandResize();
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize spectrum"
      className={RESIZE_HANDLE_CLASS}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

const OverviewBand: React.FC<OverviewBandProps> = ({ children }) => {
  const bandHeight = useOverviewBandHeight();
  const spectrumVisible = useTimelineStore((s) => s.spectrumVisible);

  return (
    <div data-overview-band className={BAND_CLASS} style={{ minHeight: bandHeight }}>
      {children}
      <Activity mode={spectrumVisible ? "visible" : "hidden"}>
        <BandViewport label="overview band controls" className="z-30">
          <BandResizeHandle />
        </BandViewport>
      </Activity>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { OverviewBand };
