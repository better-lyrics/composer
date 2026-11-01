import { SPECTRUM_BAND_HEIGHT } from "@/domain/spectrum/settings";
import { useSettingsStore } from "@/stores/settings";
import { useMountedOverviewBand, useOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { BandViewport } from "@/views/timeline/overview/band-viewport";
import { useBandResize } from "@/views/timeline/overview/use-band-resize";
import { SpectrumCanvas } from "@/views/timeline/spectrum/spectrum-canvas";
import { SpectrumReadout } from "@/views/timeline/spectrum/spectrum-readout";
import { useSpectrumSession } from "@/views/timeline/spectrum/use-spectrum-session";
import { Activity, type ReactNode, useEffect, useRef } from "react";

// -- Interfaces ----------------------------------------------------------------

interface OverviewBandProps {
  children: ReactNode;
}

// -- Constants -----------------------------------------------------------------

const BAND_CLASS =
  "group/band sticky ml-12 top-0 z-40 bg-(--well) w-max motion-safe:transition-[min-height] motion-safe:duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] [[data-overview-resizing]_&]:transition-none";

const RESIZE_HANDLE_CLASS =
  "pointer-events-auto absolute inset-x-0 -bottom-1 h-[9px] cursor-ns-resize after:absolute after:top-[3px] after:left-1/2 after:-ml-[18px] after:h-[3px] after:w-9 after:rounded-[2px] after:bg-(--edge-strong) after:opacity-0 after:transition-opacity after:duration-150 after:ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/band:after:opacity-100 before:absolute before:inset-x-0 before:top-1 before:h-px before:bg-composer-accent before:opacity-0 before:transition-opacity before:duration-150 before:ease-[cubic-bezier(0.22,1,0.36,1)] hover:before:opacity-100 hover:after:bg-composer-accent [[data-overview-resizing]_&]:before:opacity-100 [[data-overview-resizing]_&]:after:bg-composer-accent [[data-overview-resizing]_&]:after:opacity-100";

// -- Components ----------------------------------------------------------------

const BandResizeHandle: React.FC = () => {
  const { onPointerDown, onDoubleClick, onKeyDown } = useBandResize();
  const bandHeight = useOverviewBandHeight();
  return (
    <div
      role="separator"
      data-band-resize-handle
      tabIndex={0}
      aria-orientation="horizontal"
      aria-label="Resize spectrum"
      aria-valuenow={bandHeight}
      aria-valuemin={SPECTRUM_BAND_HEIGHT.min}
      aria-valuemax={SPECTRUM_BAND_HEIGHT.max}
      onKeyDown={onKeyDown}
      className={RESIZE_HANDLE_CLASS}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

// The rows list measures its offset only on scroll, so a band height change has to announce itself.
function useAnnounceBandResize(bandRef: React.RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const band = bandRef.current;
    const container = band?.closest<HTMLElement>("[data-scroll-container]");
    if (!band || !container) return;
    const observer = new ResizeObserver(() => container.dispatchEvent(new Event("scroll")));
    observer.observe(band);
    return () => observer.disconnect();
  }, [bandRef]);
}

const OverviewBand: React.FC<OverviewBandProps> = ({ children }) => {
  const bandRef = useRef<HTMLDivElement>(null);
  const bandHeight = useOverviewBandHeight();
  const showSpectrum = useSettingsStore((s) => s.showSpectrum);
  useSpectrumSession();
  useAnnounceBandResize(bandRef);
  useMountedOverviewBand(bandRef);

  return (
    <div ref={bandRef} data-overview-band className={BAND_CLASS} style={{ minHeight: bandHeight }}>
      <Activity mode={showSpectrum ? "visible" : "hidden"}>
        <div className="absolute inset-0 bottom-px overflow-clip pointer-events-none">
          <SpectrumCanvas />
        </div>
      </Activity>
      {children}
      <Activity mode={showSpectrum ? "visible" : "hidden"}>
        <BandViewport label="overview band controls" className="z-30 overflow-x-clip">
          <SpectrumReadout />
          <BandResizeHandle />
        </BandViewport>
      </Activity>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { OverviewBand };
