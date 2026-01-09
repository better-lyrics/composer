import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[TimelineWaveform]";
const TIME_UPDATE_INTERVAL_MS = 50;
const WAVEFORM_HEIGHT = 80;

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
  const setDuration = useAudioStore((s) => s.setDuration);

  const activeTab = useProjectStore((s) => s.activeTab);

  const zoom = useTimelineStore((s) => s.zoom);
  const setScrollLeft = useTimelineStore((s) => s.setScrollLeft);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || wsRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "rgba(255, 255, 255, 0.3)",
      progressColor: "rgb(129, 140, 248)",
      cursorColor: "rgb(129, 140, 248)",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: WAVEFORM_HEIGHT,
      normalize: true,
      hideScrollbar: true,
      minPxPerSec: zoom,
    });

    ws.on("ready", () => {
      setDuration(ws.getDuration());
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
    ws.on("scroll", (visibleStartTime) => setScrollLeft(visibleStartTime * zoom));
    ws.on("error", (err) => console.error(LOG_PREFIX, "Error:", err));

    wsRef.current = ws;
  }, [zoom, playbackRate, setCurrentTime, setIsPlaying, setDuration, setScrollLeft]);

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

  // Sync playback state (only when Timeline tab is active)
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    // Pause if not on Timeline tab
    if (activeTab !== "timeline") {
      if (ws.isPlaying()) ws.pause();
      return;
    }

    if (isPlaying && !ws.isPlaying()) ws.play();
    else if (!isPlaying && ws.isPlaying()) ws.pause();
  }, [isPlaying, activeTab]);

  // Sync playback rate
  useEffect(() => {
    wsRef.current?.setPlaybackRate(playbackRate);
  }, [playbackRate]);

  // Sync seek from external changes (only when not playing)
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.isPlaying()) return;
    const duration = ws.getDuration();
    if (duration > 0 && Math.abs(ws.getCurrentTime() - currentTime) > 0.1) {
      ws.seekTo(currentTime / duration);
    }
  }, [currentTime]);

  // Sync zoom
  useEffect(() => {
    wsRef.current?.zoom(zoom);
  }, [zoom]);

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
      ref={containerRef}
      className="w-full cursor-pointer"
      style={{ height: WAVEFORM_HEIGHT }}
      onWheel={handleWheel}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineWaveform, WAVEFORM_HEIGHT };
