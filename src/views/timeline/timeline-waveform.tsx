import { useAudioStore } from "@/stores/audio";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import WavesurferPlayer from "@wavesurfer/react";
import { useCallback, useEffect, useState } from "react";
import type WaveSurfer from "wavesurfer.js";

// -- Constants -----------------------------------------------------------------

const WAVEFORM_HEIGHT = 80;

// -- Component -----------------------------------------------------------------

const TimelineWaveform: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const duration = useAudioStore((s) => s.duration);
  const audioElement = useAudioStore((s) => s.audioElement);
  const seekTo = useAudioStore((s) => s.seekTo);

  const zoom = useTimelineStore((s) => s.zoom);

  const [ws, setWs] = useState<WaveSurfer | null>(null);

  const totalWidth = duration > 0 ? duration * zoom : 0;

  // Sync zoom imperatively
  useEffect(() => {
    if (!ws) return;
    ws.zoom(zoom);
  }, [ws, zoom]);

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!duration || totalWidth <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = (x / totalWidth) * duration;
      seekTo(time);
    },
    [duration, totalWidth, seekTo],
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
    <div
      className="sticky ml-12 top-0 z-40 bg-composer-bg w-max border-b border-composer-border shadow-lg transition-opacity duration-150 ease-in"
      style={{ opacity: ws ? 1 : 0 }}
    >
      <WavesurferPlayer
        height={WAVEFORM_HEIGHT}
        waveColor="#737476"
        progressColor="#818cf8"
        cursorColor="transparent"
        barWidth={2}
        barGap={1}
        barRadius={12}
        media={audioElement ?? undefined}
        interact={false}
        hideScrollbar={true}
        fillParent={false}
        minPxPerSec={useTimelineStore.getState().zoom}
        onDestroy={onDestroy}
        onReady={onReady}
      />
      <div
        className="absolute top-0 left-0 z-10 cursor-pointer"
        key="waveform-click-layer"
        style={{
          width: totalWidth,
          height: WAVEFORM_HEIGHT,
        }}
        onClick={handleClick}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineWaveform, WAVEFORM_HEIGHT };
