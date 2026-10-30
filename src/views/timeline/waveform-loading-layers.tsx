import { useSettingsStore } from "@/stores/settings";
import { cn } from "@/utils/cn";
import { useBandEmpty } from "@/views/timeline/band-empty";
import { useOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { BandViewport } from "@/views/timeline/overview/band-viewport";
import { WAVEFORM_HEIGHT } from "@/views/timeline/timeline-store";
import type { ReactNode } from "react";

// -- Interfaces ----------------------------------------------------------------

interface SongSpanProps {
  width: number;
  label: string;
  children: (width: number | string) => ReactNode;
}

interface WaveformSkeletonProps {
  width: number;
  waveformSettled: boolean;
}

// -- Components ----------------------------------------------------------------

// Until the song length is known the band has no width, so its loading layers cover the visible part instead.
const SongSpan: React.FC<SongSpanProps> = ({ width, label, children }) =>
  width > 0 ? children(width) : <BandViewport label={label}>{children("100%")}</BandViewport>;

const WaveformBackground: React.FC<{ width: number }> = ({ width }) => {
  const showSpectrum = useSettingsStore((s) => s.showSpectrum);
  return (
    <SongSpan width={width} label="waveform background viewport">
      {(spanWidth) => (
        <div
          data-waveform-redraw-bg
          className={cn(
            "absolute top-0 left-0 bg-(--well) border-b border-(--divider) pointer-events-none transition-opacity duration-200",
            showSpectrum && "opacity-0",
          )}
          style={{ width: spanWidth, height: WAVEFORM_HEIGHT }}
        />
      )}
    </SongSpan>
  );
};

// Shown whenever the band has nothing drawn in it: no waveform yet, or no spectrum yet while the spectrum shows.
const WaveformSkeleton: React.FC<WaveformSkeletonProps> = ({ width, waveformSettled }) => {
  const showSpectrum = useSettingsStore((s) => s.showSpectrum);
  const bandHeight = useOverviewBandHeight();
  const empty = useBandEmpty();
  const sweeping = empty || (!showSpectrum && !waveformSettled);
  return (
    <SongSpan width={width} label="waveform loading viewport">
      {(spanWidth) => (
        <div
          data-waveform-loading-dots
          data-sweeping={sweeping ? "" : undefined}
          aria-hidden="true"
          className="absolute top-0 left-0 waveform-loading-dots pointer-events-none transition-opacity duration-200 ease-out"
          style={{
            width: spanWidth,
            height: (showSpectrum ? bandHeight : WAVEFORM_HEIGHT) - 1,
            opacity: empty ? 1 : 0,
          }}
        />
      )}
    </SongSpan>
  );
};

// -- Exports -------------------------------------------------------------------

export { WaveformBackground, WaveformSkeleton };
