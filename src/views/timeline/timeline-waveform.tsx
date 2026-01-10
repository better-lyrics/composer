import { useAudioStore } from "@/stores/audio";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useWavesurfer } from "@wavesurfer/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

// -- Constants -----------------------------------------------------------------

const WAVEFORM_HEIGHT = 80;

// -- Component -----------------------------------------------------------------

const TimelineWaveform: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const source = useAudioStore((s) => s.source);
  const duration = useAudioStore((s) => s.duration);
  const audioElement = useAudioStore((s) => s.audioElement);
  const seekTo = useAudioStore((s) => s.seekTo);

  const zoom = useTimelineStore((s) => s.zoom);

  const totalWidth = duration > 0 ? duration * zoom : 0;

  // Create wavesurfer instance - only recreate when audioElement changes
  const options = useMemo(
    () => ({
      container: containerRef,
      height: WAVEFORM_HEIGHT,
      waveColor: "rgba(255, 255, 255, 0.35)",
      progressColor: "#818cf8",
      cursorColor: "transparent",
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      media: audioElement ?? undefined,
      interact: false,
      hideScrollbar: true,
      fillParent: false,
      minPxPerSec: useTimelineStore.getState().zoom,
    }),
    [audioElement],
  );

  const { wavesurfer, isReady } = useWavesurfer(options);

  // Sync zoom imperatively
  useEffect(() => {
    if (!wavesurfer || !isReady) return;
    wavesurfer.zoom(zoom);
  }, [wavesurfer, isReady, zoom]);

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

  if (!source) return null;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: click for seeking
    <div
      ref={containerRef}
      className="relative cursor-pointer bg-composer-bg"
      style={{
        width: totalWidth,
        height: WAVEFORM_HEIGHT,
        marginLeft: GUTTER_WIDTH,
      }}
      onClick={handleClick}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineWaveform, WAVEFORM_HEIGHT };
