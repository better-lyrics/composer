import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { cn } from "@/utils/cn";
import { readToken } from "@/utils/theme/read-token";
import { snapTimeToOnset } from "@/views/timeline/snap-marker-math";
import { WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";
import WavesurferPlayer from "@wavesurfer/react";
import { useCallback, useEffect, useState } from "react";
import type WaveSurfer from "wavesurfer.js";

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
    const { zoom: currentZoom, vocalOnsetSnapPoints, addCustomSnapPoint } = useTimelineStore.getState();
    const { vocalOnsetSnap, timelineSnapThreshold } = useSettingsStore.getState();
    const onsets = vocalOnsetSnap ? vocalOnsetSnapPoints : [];
    addCustomSnapPoint(snapTimeToOnset(time, onsets, currentZoom, timelineSnapThreshold));
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!duration || totalWidth <= 0) return;
      const time = timeFromClick(e);
      if (useTimelineStore.getState().markerMode) {
        if (e.detail > 1) return;
        addSnappedPoint(time);
        return;
      }
      seekTo(time);
    },
    [duration, totalWidth, seekTo, timeFromClick, addSnappedPoint],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!duration || totalWidth <= 0) return;
      if (useTimelineStore.getState().markerMode) return;
      addSnappedPoint(timeFromClick(e));
    },
    [duration, totalWidth, timeFromClick, addSnappedPoint],
  );

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
        onDoubleClick={handleDoubleClick}
        onKeyDown={() => {}}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineWaveform };
