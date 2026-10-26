import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { isAbortError } from "@/utils/abort-error";
import { cn } from "@/utils/cn";
import { readToken } from "@/utils/theme/read-token";
import { BeatGridCanvas } from "@/views/timeline/beat-grid/beat-grid-canvas";
import { startLoopRegionDrag } from "@/views/timeline/loop-region-drag";
import { LoopRegionEdges } from "@/views/timeline/loop-region-edges";
import { useOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { OverviewBand } from "@/views/timeline/overview/overview-band";
import { placeSnapPoint } from "@/views/timeline/place-snap-point";
import { snapPlayheadTime } from "@/views/timeline/playhead-snap";
import { clearLoopRegion } from "@/views/timeline/selection-playback";
import { WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";
import { WaveformFocusShade } from "@/views/timeline/waveform-focus-shade";
import WavesurferPlayer from "@wavesurfer/react";
import { useCallback, useEffect, useState } from "react";
import type WaveSurfer from "wavesurfer.js";

// -- Interfaces ----------------------------------------------------------------

interface WaveformBarsProps {
  media: HTMLAudioElement;
  width: number;
  shown: boolean;
  colors: { wave: string; progress: string };
  initialZoom: number;
  onDestroy: () => void;
  onReady: (wavesurfer: WaveSurfer) => void;
}

// -- Constants -----------------------------------------------------------------

const FADE_SETTLE_MS = 260;
// The bars sit in a 13px margin inside the 80px band.
const WAVEFORM_BARS_HEIGHT = 54;
const LOG_PREFIX = "[TimelineWaveform]";

// -- Component -----------------------------------------------------------------

const WaveformBars: React.FC<WaveformBarsProps> = ({
  media,
  width,
  shown,
  colors,
  initialZoom,
  onDestroy,
  onReady,
}) => (
  <div
    data-waveform-fade
    className="pt-[13px] overflow-clip transition-opacity duration-150 ease-in"
    style={{ width, opacity: shown ? 1 : 0 }}
  >
    <div className="w-max">
      <WavesurferPlayer
        height={WAVEFORM_BARS_HEIGHT}
        waveColor={colors.wave}
        progressColor={colors.progress}
        cursorColor="transparent"
        barWidth={2}
        barGap={1}
        barRadius={12}
        media={media}
        interact={false}
        hideScrollbar={true}
        fillParent={false}
        minPxPerSec={initialZoom}
        onDestroy={onDestroy}
        onReady={onReady}
      />
    </div>
  </div>
);

const TimelineWaveform: React.FC = () => {
  const bandHeight = useOverviewBandHeight();
  const source = useAudioStore((s) => s.source);
  const duration = useAudioStore((s) => s.duration);
  const audioElement = useAudioStore((s) => s.audioElement);
  const seekTo = useAudioStore((s) => s.seekTo);

  const zoom = useTimelineStore((s) => s.zoom);
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const markerMode = useTimelineStore((s) => s.markerMode);
  const showSpectrum = useSettingsStore((s) => s.showSpectrum);

  const [ws, setWs] = useState<WaveSurfer | null>(null);
  const [settledFor, setSettledFor] = useState<WaveSurfer | null>(null);
  const [altHeld, setAltHeld] = useState(false);

  // Never move this into an effect: opacity and the sweep gate must land in the same commit.
  const sweeping = ws === null || settledFor !== ws;

  const totalWidth = duration > 0 ? duration * zoom : 0;
  const waveformKey = audioElement?.src ?? "no-audio";

  const [initialColors] = useState(() => ({
    wave: readToken("wave"),
    progress: readToken("wave-progress"),
  }));
  // @wavesurfer/react rebuilds the instance whenever any option changes; later zooms go through ws.setOptions(), which unlike ws.zoom() never throws mid-reload.
  const [initialZoom] = useState(() => useTimelineStore.getState().zoom);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeThemeId re-applies DOM-resolved colors on theme change without remounting WaveSurfer
  useEffect(() => {
    if (!ws) return;
    ws.setOptions({ waveColor: readToken("wave"), progressColor: readToken("wave-progress") });
  }, [ws, activeThemeId]);

  useEffect(() => {
    if (!ws || !audioElement) return;
    const onLoadStart = () => {
      if (!audioElement.src) return;
      ws.load(audioElement.src).catch((error: unknown) => {
        if (!isAbortError(error)) console.error(LOG_PREFIX, "waveform reload failed", error);
      });
    };
    audioElement.addEventListener("loadstart", onLoadStart);
    return () => audioElement.removeEventListener("loadstart", onLoadStart);
  }, [ws, audioElement]);

  // Hidden under the spectrum the waveform keeps its old zoom; it catches up when it shows again.
  useEffect(() => {
    if (!ws || showSpectrum || ws.options.minPxPerSec === zoom) return;
    ws.setOptions({ minPxPerSec: zoom });
  }, [ws, zoom, showSpectrum]);

  useEffect(() => {
    if (!ws) return;
    const timer = setTimeout(() => setSettledFor(ws), FADE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ws]);

  const timeFromClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      return (x / totalWidth) * duration;
    },
    [duration, totalWidth],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!duration || totalWidth <= 0) return;
      const time = timeFromClick(e);
      if (useTimelineStore.getState().markerMode) {
        if (e.detail <= 1) placeSnapPoint(time);
        return;
      }
      if (e.altKey) {
        placeSnapPoint(time);
        return;
      }
      clearLoopRegion();
      seekTo(snapPlayheadTime(time, e.metaKey));
    },
    [duration, totalWidth, timeFromClick, seekTo],
  );

  const onDestroy = useCallback(() => {
    setWs(null);
    setSettledFor(null);
  }, []);

  const onReady = useCallback((wavesurfer: WaveSurfer) => {
    setWs(wavesurfer);
    const audio = useAudioStore.getState().audioElement;
    if (audio && audio.currentTime > 0) {
      wavesurfer.setTime(audio.currentTime);
    }
  }, []);

  if (!source) return null;

  // A bunch of heights here are -1 to account for the 1px border at the bottom of the waveform container.
  return (
    <OverviewBand>
      <div
        data-waveform-redraw-bg
        className={cn(
          "absolute top-0 left-0 bg-(--well) border-b border-(--divider) pointer-events-none transition-opacity duration-200",
          showSpectrum && "opacity-0",
        )}
        style={{ width: totalWidth, height: WAVEFORM_HEIGHT }}
      />
      <BeatGridCanvas />
      <div
        data-waveform-loading-dots
        data-sweeping={sweeping ? "" : undefined}
        aria-hidden="true"
        className="absolute top-0 left-0 waveform-loading-dots pointer-events-none transition-opacity duration-200 ease-out"
        style={{ width: totalWidth, height: WAVEFORM_HEIGHT - 1, opacity: ws || showSpectrum ? 0 : 1 }}
      />
      {audioElement && (
        <WaveformBars
          key={waveformKey}
          media={audioElement}
          width={totalWidth}
          shown={ws !== null && !showSpectrum}
          colors={initialColors}
          initialZoom={initialZoom}
          onDestroy={onDestroy}
          onReady={onReady}
        />
      )}
      <WaveformFocusShade />
      <div
        role="button"
        tabIndex={-1}
        aria-label={markerMode ? "Place snap point" : "Seek to position"}
        className={cn(
          "absolute top-0 left-0 z-10",
          markerMode ? "waveform-armed" : altHeld || showSpectrum ? "cursor-crosshair" : "cursor-pointer",
        )}
        key="waveform-click-layer"
        style={{
          width: totalWidth,
          height: bandHeight - 1,
        }}
        onMouseDown={(e) => {
          if (useTimelineStore.getState().pasteMode.status === "preview") return;
          const container = e.currentTarget.closest<HTMLElement>("[data-scroll-container]");
          if (container) startLoopRegionDrag(e, container, null);
        }}
        onClick={handleClick}
        onPointerMove={(e) => setAltHeld(e.altKey)}
        onKeyDown={() => {}}
      />
      <LoopRegionEdges />
    </OverviewBand>
  );
};

// -- Exports -------------------------------------------------------------------

export { FADE_SETTLE_MS, TimelineWaveform };
