import { useAudioStore } from "@/stores/audio";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback, useEffect, useRef } from "react";

// -- Constants -----------------------------------------------------------------

const WAVEFORM_HEIGHT = 80;
const GUTTER_WIDTH = 48;

// -- Component -----------------------------------------------------------------

const TimelineWaveform: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveformDataRef = useRef<number[] | null>(null);

  const source = useAudioStore((s) => s.source);
  const duration = useAudioStore((s) => s.duration);
  const currentTime = useAudioStore((s) => s.currentTime);
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const audioElement = useAudioStore((s) => s.audioElement);
  const waveformData = useAudioStore((s) => s.waveformData);
  const seekTo = useAudioStore((s) => s.seekTo);

  const zoom = useTimelineStore((s) => s.zoom);
  const isDraggingPlayhead = useTimelineStore((s) => s.isDraggingPlayhead);
  const dragTime = useTimelineStore((s) => s.dragTime);

  const totalWidth = duration > 0 ? duration * zoom : 0;
  const displayTime = isDraggingPlayhead ? dragTime : currentTime;

  // Keep ref in sync with store data
  useEffect(() => {
    waveformDataRef.current = waveformData;
  }, [waveformData]);

  // Smooth time updates with direct canvas drawing during playback
  useEffect(() => {
    const audio = audioElement;
    const canvas = overlayCanvasRef.current;
    if (!audio || !isPlaying) return;

    let rafId: number;
    let lastStateUpdate = 0;

    const drawOverlay = () => {
      const data = waveformDataRef.current;
      if (!canvas || !data || duration <= 0 || totalWidth <= 0) {
        rafId = requestAnimationFrame(drawOverlay);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafId = requestAnimationFrame(drawOverlay);
        return;
      }

      const time = audio.currentTime;
      const dpr = window.devicePixelRatio || 1;
      const width = totalWidth;
      const height = WAVEFORM_HEIGHT;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const barWidth = 2;
      const barGap = 1;
      const barStep = barWidth + barGap;
      const numBars = Math.floor(width / barStep);
      const samplesPerBar = data.length / numBars;
      const progressWidth = (time / duration) * width;

      ctx.fillStyle = "rgba(129, 140, 248, 0.5)";

      for (let i = 0; i < numBars; i++) {
        const x = i * barStep;
        if (x > progressWidth) break;

        const sampleIndex = Math.floor(i * samplesPerBar);
        const value = data[sampleIndex] || 0;
        const barHeight = Math.max(2, value * (height - 4));
        const y = (height - barHeight) / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1);
        ctx.fill();
      }

      // Gradient overlay
      const overlayWidth = 36;
      const actualOverlayWidth = Math.min(overlayWidth, progressWidth);
      const overlayStart = progressWidth - actualOverlayWidth;
      const gradient = ctx.createLinearGradient(overlayStart, 0, progressWidth, 0);
      gradient.addColorStop(0, "rgba(129, 140, 248, 0)");
      gradient.addColorStop(1, "rgba(129, 140, 248, 0.05)");
      ctx.fillStyle = gradient;
      ctx.fillRect(overlayStart, 0, actualOverlayWidth, height);

      // Update React state at 30fps for other components
      const now = performance.now();
      if (now - lastStateUpdate > 33) {
        setCurrentTime(time);
        lastStateUpdate = now;
      }

      rafId = requestAnimationFrame(drawOverlay);
    };
    rafId = requestAnimationFrame(drawOverlay);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying, audioElement, setCurrentTime, duration, totalWidth]);

  // Draw static waveform (only when waveform data or zoom changes)
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
  }, [waveformData, totalWidth]);

  // Draw progress overlay when paused or dragging
  useEffect(() => {
    if (isPlaying && !isDraggingPlayhead) return;

    const canvas = overlayCanvasRef.current;
    if (!canvas || !waveformData || totalWidth <= 0 || duration <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = totalWidth;
    const height = WAVEFORM_HEIGHT;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const barWidth = 2;
    const barGap = 1;
    const barStep = barWidth + barGap;
    const numBars = Math.floor(width / barStep);
    const samplesPerBar = waveformData.length / numBars;
    const progressWidth = (displayTime / duration) * width;

    ctx.fillStyle = "rgba(129, 140, 248, 0.5)";

    for (let i = 0; i < numBars; i++) {
      const x = i * barStep;
      if (x > progressWidth) break;

      const sampleIndex = Math.floor(i * samplesPerBar);
      const value = waveformData[sampleIndex] || 0;
      const barHeight = Math.max(2, value * (height - 4));
      const y = (height - barHeight) / 2;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    }

    // Draw full-height gradient overlay to the left of cursor
    const overlayWidth = 36;
    const actualOverlayWidth = Math.min(overlayWidth, progressWidth);
    const overlayStart = progressWidth - actualOverlayWidth;
    const gradient = ctx.createLinearGradient(overlayStart, 0, progressWidth, 0);
    gradient.addColorStop(0, "rgba(129, 140, 248, 0)");
    gradient.addColorStop(1, "rgba(129, 140, 248, 0.05)");
    ctx.fillStyle = gradient;
    ctx.fillRect(overlayStart, 0, actualOverlayWidth, height);
  }, [isPlaying, isDraggingPlayhead, waveformData, totalWidth, displayTime, duration]);

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!duration || totalWidth <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = (x / totalWidth) * duration;
      seekTo(time);
    },
    [duration, totalWidth, seekTo],
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
    [zoom],
  );

  if (!source) return null;

  return (
    <div className="flex" style={{ width: totalWidth > 0 ? totalWidth + GUTTER_WIDTH : "100%" }}>
      <div className="shrink-0 w-12 border-r border-composer-border/50 bg-composer-bg" />
      <div className="relative" style={{ width: totalWidth, height: WAVEFORM_HEIGHT }}>
        <canvas ref={canvasRef} className="absolute inset-0" style={{ height: WAVEFORM_HEIGHT }} />
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: canvas click for seeking */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 cursor-pointer"
          style={{ height: WAVEFORM_HEIGHT }}
          onClick={handleClick}
          onWheel={handleWheel}
        />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineWaveform, WAVEFORM_HEIGHT };
