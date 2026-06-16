import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { cn } from "@/utils/cn";
import { readToken } from "@/utils/theme/read-token";
import { snapTimeToOnset } from "@/views/timeline/snap-marker-math";
import { WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";
import WavesurferPlayer from "@wavesurfer/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";

// -- Constants -----------------------------------------------------------------

const DOUBLE_CLICK_MS = 400;
const DOUBLE_CLICK_PX = 6;

// -- Component -----------------------------------------------------------------

const TimelineWaveform: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const duration = useAudioStore((s) => s.duration);
  const audioElement = useAudioStore((s) => s.audioElement);
  const seekTo = useAudioStore((s) => s.seekTo);

  const zoom = useTimelineStore((s) => s.zoom);
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const markerMode = useTimelineStore((s) => s.markerMode);

  const [ws, setWs] = useState<WaveSurfer | null>(null);
  const clickLayerRef = useRef<HTMLDivElement>(null);

  const totalWidth = duration > 0 ? duration * zoom : 0;
  const waveformKey = audioElement?.src ?? "no-audio";

  const [initialColors] = useState(() => ({
    wave: readToken("wave"),
    progress: readToken("wave-progress"),
  }));

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeThemeId re-applies DOM-resolved colors on theme change without remounting WaveSurfer
  useEffect(() => {
    if (!ws) return;
    ws.setOptions({ waveColor: readToken("wave"), progressColor: readToken("wave-progress") });
  }, [ws, activeThemeId]);

  useEffect(() => {
    if (!ws || !audioElement) return;
    const onLoadStart = () => {
      if (audioElement.src) void ws.load(audioElement.src);
    };
    audioElement.addEventListener("loadstart", onLoadStart);
    return () => audioElement.removeEventListener("loadstart", onLoadStart);
  }, [ws, audioElement]);

  useEffect(() => {
    if (!ws) return;
    ws.zoom(zoom);
  }, [ws, zoom]);

  const timeFromClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      return (x / totalWidth) * duration;
    },
    [duration, totalWidth],
  );

  const addSnappedPoint = useCallback((time: number) => {
    const { zoom: currentZoom, vocalOnsetSnapPoints } = useTimelineStore.getState();
    const { vocalOnsetSnap, timelineSnapThreshold } = useSettingsStore.getState();
    const onsets = vocalOnsetSnap ? vocalOnsetSnapPoints : [];
    useProjectStore.getState().addCustomSnapPoint(snapTimeToOnset(time, onsets, currentZoom, timelineSnapThreshold));
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!duration || totalWidth <= 0) return;
      if (useTimelineStore.getState().markerMode && e.detail <= 1) {
        addSnappedPoint(timeFromClick(e));
      }
    },
    [duration, totalWidth, timeFromClick, addSnappedPoint],
  );

  // Marker-off clicks seek here, not on the layer's onClick. A single seek
  // slides the playhead under the cursor, so the second click of a double-click
  // lands on the playhead and the native dblclick never reaches the layer.
  // Watching clicks at the document level catches the pair wherever they land. A
  // single click seeks instantly; a double-click drops a snap point and restores
  // the playhead, so placing a marker never leaves the cursor at that spot.
  useEffect(() => {
    if (duration <= 0 || totalWidth <= 0) return;
    let lastClick: { t: number; x: number; y: number; timeBefore: number } | null = null;

    const onDocumentClick = (e: MouseEvent) => {
      const layer = clickLayerRef.current;
      if (!layer) return;
      // Snap-marker pins live in the overlay; their hover tooltip (time + delete
      // button) is rendered in a FloatingPortal outside it, so guard both or a
      // click on the delete control would fall through to a seek.
      if ((e.target as HTMLElement | null)?.closest("[data-snap-markers-overlay], [data-snap-marker-tooltip]")) return;

      const rect = layer.getBoundingClientRect();
      const inStrip =
        e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inStrip || useTimelineStore.getState().markerMode) {
        lastClick = null;
        return;
      }

      const time = ((e.clientX - rect.left) / totalWidth) * duration;
      const prev = lastClick;
      const isDoubleClick =
        prev !== null &&
        e.timeStamp - prev.t <= DOUBLE_CLICK_MS &&
        Math.abs(e.clientX - prev.x) <= DOUBLE_CLICK_PX &&
        Math.abs(e.clientY - prev.y) <= DOUBLE_CLICK_PX;

      if (isDoubleClick && prev) {
        addSnappedPoint(time);
        seekTo(prev.timeBefore);
        lastClick = null;
      } else {
        const { audioElement: audio, currentTime } = useAudioStore.getState();
        const timeBefore = audio?.currentTime ?? currentTime;
        seekTo(time);
        lastClick = { t: e.timeStamp, x: e.clientX, y: e.clientY, timeBefore };
      }
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [duration, totalWidth, addSnappedPoint, seekTo]);

  const onDestroy = useCallback(() => setWs(null), []);

  const onReady = useCallback((wavesurfer: WaveSurfer) => {
    setWs(wavesurfer);
    const audio = useAudioStore.getState().audioElement;
    if (audio && audio.currentTime > 0) {
      wavesurfer.setTime(audio.currentTime);
    }
  }, []);

  if (!source) return null;

  return (
    <div className="sticky ml-12 top-0 z-40 bg-composer-bg w-max">
      <div
        data-waveform-redraw-bg
        className="absolute top-0 left-0 bg-composer-bg border-b border-composer-border shadow-lg pointer-events-none"
        style={{ width: totalWidth, height: WAVEFORM_HEIGHT }}
      />
      <div
        data-waveform-loading-dots
        aria-hidden="true"
        className="absolute top-0 left-0 waveform-loading-dots pointer-events-none transition-opacity duration-200 ease-out"
        style={{ width: totalWidth, height: WAVEFORM_HEIGHT, opacity: ws ? 0 : 1 }}
      />
      {audioElement && (
        <div data-waveform-fade className="transition-opacity duration-150 ease-in" style={{ opacity: ws ? 1 : 0 }}>
          <WavesurferPlayer
            key={waveformKey}
            height={WAVEFORM_HEIGHT}
            waveColor={initialColors.wave}
            progressColor={initialColors.progress}
            cursorColor="transparent"
            barWidth={2}
            barGap={1}
            barRadius={12}
            media={audioElement}
            interact={false}
            hideScrollbar={true}
            fillParent={false}
            minPxPerSec={useTimelineStore.getState().zoom}
            onDestroy={onDestroy}
            onReady={onReady}
          />
        </div>
      )}
      <div
        ref={clickLayerRef}
        role="button"
        tabIndex={-1}
        aria-label={markerMode ? "Place snap point" : "Seek to position"}
        className={cn(
          "absolute top-0 left-0 z-10 transition-shadow duration-200 ease-out",
          markerMode ? "waveform-armed" : "cursor-pointer",
        )}
        key="waveform-click-layer"
        style={{
          width: totalWidth,
          height: WAVEFORM_HEIGHT,
        }}
        onClick={handleClick}
        onKeyDown={() => {}}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineWaveform };
