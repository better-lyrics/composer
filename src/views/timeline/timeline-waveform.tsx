import { useAudioStore } from "@/stores/audio";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback, useEffect, useRef, useState } from "react";

// -- Constants -----------------------------------------------------------------

const WAVEFORM_HEIGHT = 80;
const SAMPLES_PER_PIXEL = 100;
const GUTTER_WIDTH = 48;

// -- Component -----------------------------------------------------------------

const TimelineWaveform: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [waveformData, setWaveformData] = useState<number[] | null>(null);

  const source = useAudioStore((s) => s.source);
  const duration = useAudioStore((s) => s.duration);
  const currentTime = useAudioStore((s) => s.currentTime);
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
  const setDuration = useAudioStore((s) => s.setDuration);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
  const playbackRate = useAudioStore((s) => s.playbackRate);

  const zoom = useTimelineStore((s) => s.zoom);

  const totalWidth = duration > 0 ? duration * zoom : 0;

  // Create audio element and decode waveform
  useEffect(() => {
    if (!source || source.type !== "file") return;

    const audio = new Audio();
    audio.src = URL.createObjectURL(source.file);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
    });

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
    });

    // Decode audio for waveform
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    source.file.arrayBuffer().then((arrayBuffer) => {
      audioContext.decodeAudioData(arrayBuffer).then((audioBuffer) => {
        const channelData = audioBuffer.getChannelData(0);
        const samples: number[] = [];
        const step = Math.floor(
          channelData.length / (audioBuffer.duration * SAMPLES_PER_PIXEL)
        );

        for (let i = 0; i < channelData.length; i += step) {
          let sum = 0;
          const count = Math.min(step, channelData.length - i);
          for (let j = 0; j < count; j++) {
            sum += Math.abs(channelData[i + j]);
          }
          samples.push(sum / count);
        }

        // Normalize
        const max = Math.max(...samples);
        const normalized = samples.map((s) => s / max);
        setWaveformData(normalized);
      });
    });

    return () => {
      audio.pause();
      audio.src = "";
      URL.revokeObjectURL(audio.src);
      audioContext.close();
    };
  }, [source, setDuration, setCurrentTime, setIsPlaying]);

  // Sync playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play();
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Sync playback rate
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData || totalWidth <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = totalWidth;
    const height = WAVEFORM_HEIGHT;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Draw waveform bars
    const barWidth = 2;
    const barGap = 1;
    const barStep = barWidth + barGap;
    const numBars = Math.floor(width / barStep);
    const samplesPerBar = waveformData.length / numBars;

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";

    for (let i = 0; i < numBars; i++) {
      const sampleIndex = Math.floor(i * samplesPerBar);
      const value = waveformData[sampleIndex] || 0;
      const barHeight = Math.max(2, value * (height - 4));
      const x = i * barStep;
      const y = (height - barHeight) / 2;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    }

    // Draw progress overlay with gradient near cursor
    const progressWidth = (currentTime / duration) * width;

    for (let i = 0; i < numBars; i++) {
      const x = i * barStep;
      if (x > progressWidth) break;

      const sampleIndex = Math.floor(i * samplesPerBar);
      const value = waveformData[sampleIndex] || 0;
      const barHeight = Math.max(2, value * (height - 4));
      const y = (height - barHeight) / 2;

      ctx.fillStyle = "rgba(129, 140, 248, 0.5)";
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    }

    // Draw full-height gradient overlay to the left of cursor
    const overlayWidth = 36;
    const overlayStart = Math.max(0, progressWidth - overlayWidth);
    const gradient = ctx.createLinearGradient(
      overlayStart,
      0,
      progressWidth,
      0
    );
    gradient.addColorStop(0, "rgba(129, 140, 248, 0)");
    gradient.addColorStop(1, "rgba(129, 140, 248, 0.1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(overlayStart, 0, overlayWidth, height);
  }, [waveformData, totalWidth, currentTime, duration]);

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!duration || totalWidth <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = (x / totalWidth) * duration;
      setCurrentTime(time);

      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = time;
      }
    },
    [duration, totalWidth, setCurrentTime]
  );

  // Handle wheel for zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -20 : 20;
        useTimelineStore.getState().setZoom(zoom + delta);
      }
    },
    [zoom]
  );

  if (!source) return null;

  return (
    <div
      className="flex"
      style={{ width: totalWidth > 0 ? totalWidth + GUTTER_WIDTH : "100%" }}
    >
      <div className="shrink-0 w-12 border-r border-composer-border/50 bg-composer-bg" />
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: fuck you*/}
      <canvas
        ref={canvasRef}
        className="cursor-pointer"
        style={{ height: WAVEFORM_HEIGHT }}
        onClick={handleClick}
        onWheel={handleWheel}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineWaveform, WAVEFORM_HEIGHT };
