import { useAudioStore } from "@/stores/audio";
import { useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

const LOG_PREFIX = "[TimelineWaveform]";
const TIME_UPDATE_INTERVAL_MS = 66;

const WAVEFORM_OPTIONS = {
  waveColor: "rgba(255, 255, 255, 0.3)",
  progressColor: "rgb(129, 140, 248)",
  cursorColor: "rgb(129, 140, 248)",
  cursorWidth: 2,
  barWidth: 2,
  barGap: 1,
  barRadius: 2,
  height: 120,
  normalize: true,
  hideScrollbar: true,
};

// -- Component -----------------------------------------------------------------

const TimelineWaveform: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const loadedSourceRef = useRef<File | null>(null);
  const lastTimeUpdateRef = useRef<number>(0);

  const source = useAudioStore((s) => s.source);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const currentTime = useAudioStore((s) => s.currentTime);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || wsRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      ...WAVEFORM_OPTIONS,
    });

    ws.on("ready", () => {
      ws.setPlaybackRate(playbackRate);
    });

    ws.on("timeupdate", (time) => {
      const now = performance.now();
      if (now - lastTimeUpdateRef.current >= TIME_UPDATE_INTERVAL_MS) {
        lastTimeUpdateRef.current = now;
        setCurrentTime(time);
      }
    });

    ws.on("seeking", (time) => setCurrentTime(time));
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));
    ws.on("error", (err) => console.error(LOG_PREFIX, "Error:", err));

    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [playbackRate, setCurrentTime, setIsPlaying]);

  // Load audio file
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !source || source.type !== "file") return;
    if (loadedSourceRef.current === source.file) return;

    loadedSourceRef.current = source.file;
    const url = URL.createObjectURL(source.file);
    ws.load(url);

    return () => URL.revokeObjectURL(url);
  }, [source]);

  // Sync playback state
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    if (isPlaying && !ws.isPlaying()) {
      ws.play();
    } else if (!isPlaying && ws.isPlaying()) {
      ws.pause();
    }
  }, [isPlaying]);

  // Sync playback rate
  useEffect(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

  // Sync seek from external changes
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.isPlaying()) return;

    const duration = ws.getDuration();
    if (duration > 0) {
      const wsTime = ws.getCurrentTime();
      if (Math.abs(wsTime - currentTime) > 0.1) {
        ws.seekTo(currentTime / duration);
      }
    }
  }, [currentTime]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const ws = wsRef.current;
    if (!ws) return;

    e.preventDefault();
    const currentZoom = ws.options.minPxPerSec ?? 50;
    const delta = e.deltaY > 0 ? -10 : 10;
    const newZoom = Math.max(10, Math.min(500, currentZoom + delta));
    ws.zoom(newZoom);
  }, []);

  if (!source) return null;

  return <div ref={containerRef} className="w-full cursor-pointer" onWheel={handleWheel} />;
};

// -- Exports -------------------------------------------------------------------

export { TimelineWaveform };
