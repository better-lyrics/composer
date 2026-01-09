import { useAudioContext } from "@/audio/audio-context";
import { useAudioStore } from "@/stores/audio";
import { useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

const LOG_PREFIX = "[Waveform]";

// Throttle time updates to ~15fps to reduce re-renders while maintaining smooth playback
const TIME_UPDATE_INTERVAL_MS = 66;

const WAVEFORM_OPTIONS = {
  waveColor: "rgba(255, 255, 255, 0.3)",
  progressColor: "rgb(129, 140, 248)",
  cursorColor: "rgb(129, 140, 248)",
  cursorWidth: 2,
  barWidth: 2,
  barGap: 1,
  barRadius: 2,
  height: 80,
  normalize: true,
  hideScrollbar: true,
};

const Waveform: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedSourceRef = useRef<File | null>(null);
  const lastTimeUpdateRef = useRef<number>(0);

  const { wavesurferRef } = useAudioContext();
  const source = useAudioStore((s) => s.source);

  useEffect(() => {
    if (!containerRef.current || wavesurferRef.current) return;

    const { setCurrentTime, setDuration, setIsPlaying, setIsLoading } = useAudioStore.getState();

    const ws = WaveSurfer.create({
      container: containerRef.current,
      ...WAVEFORM_OPTIONS,
    });

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      setIsLoading(false);
      // Apply initial playback rate
      const { playbackRate } = useAudioStore.getState();
      ws.setPlaybackRate(playbackRate);
    });

    // Throttle timeupdate to reduce re-renders
    ws.on("timeupdate", (time) => {
      const now = performance.now();
      if (now - lastTimeUpdateRef.current >= TIME_UPDATE_INTERVAL_MS) {
        lastTimeUpdateRef.current = now;
        setCurrentTime(time);
      }
    });
    // Seeking should always update immediately for responsiveness
    ws.on("seeking", (time) => setCurrentTime(time));
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));
    ws.on("error", (err) => {
      console.error(LOG_PREFIX, "Error:", err);
      setIsLoading(false);
    });

    wavesurferRef.current = ws;
  }, [wavesurferRef]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !source || source.type !== "file") return;
    if (loadedSourceRef.current === source.file) return;

    const { setIsLoading } = useAudioStore.getState();
    setIsLoading(true);
    loadedSourceRef.current = source.file;

    const url = URL.createObjectURL(source.file);
    ws.load(url);

    return () => URL.revokeObjectURL(url);
  }, [source, wavesurferRef]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const ws = wavesurferRef.current;
      if (!ws) return;

      e.preventDefault();
      const currentZoom = ws.options.minPxPerSec ?? 50;
      const delta = e.deltaY > 0 ? -10 : 10;
      const newZoom = Math.max(10, Math.min(500, currentZoom + delta));
      ws.zoom(newZoom);
    },
    [wavesurferRef],
  );

  if (!source) return null;

  return <div ref={containerRef} className="w-full cursor-pointer" onWheel={handleWheel} />;
};

export { Waveform };
