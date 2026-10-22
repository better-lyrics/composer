import { useLevelEnvelope } from "@/audio/deck/use-level-envelope";
import type { LevelEnvelope } from "@/audio/level-envelope";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useThemeStore } from "@/stores/theme";
import { Slider } from "@/ui/slider";
import { SeekBarFocusBand } from "@/views/timeline/seek-bar-focus-band";
import { useLayoutEffect, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface Bar {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Painter {
  context: CanvasRenderingContext2D | null;
  bars: Bar[];
  width: number;
  headBar: number;
  idle: string;
  played: string;
}

// -- Constants ----------------------------------------------------------------

const BAR_PITCH = 3;
const BAR_WIDTH = 2;
const MIN_BAR_HEIGHT = 2;
const BAR_SCALE = 0.7;

// -- Geometry -----------------------------------------------------------------

function bucketPeaks(envelope: LevelEnvelope, count: number): number[] {
  const [left, right] = envelope.peaks;
  const windows = left.length;
  const perBar = windows / count;
  const peaks = Array.from({ length: count }, (_, bar) => {
    const end = Math.max(Math.floor((bar + 1) * perBar), Math.floor(bar * perBar) + 1);
    let peak = 0;
    for (let window = Math.floor(bar * perBar); window < Math.min(end, windows); window++) {
      peak = Math.max(peak, left[window], right[window]);
    }
    return peak;
  });
  const loudest = Math.max(...peaks) || 1;
  return peaks.map((peak) => Math.sqrt(peak / loudest));
}

function layoutBars(values: readonly number[], height: number, pixelRatio: number): Bar[] {
  const snap = (value: number) => Math.round(value * pixelRatio) / pixelRatio;
  return values.map((value, index) => {
    const half =
      Math.max(
        Math.round((value * BAR_SCALE * height * pixelRatio) / 2),
        Math.round((MIN_BAR_HEIGHT * pixelRatio) / 2),
      ) / pixelRatio;
    const x = snap(index * BAR_PITCH);
    const width = Math.max(snap(BAR_WIDTH), 1 / pixelRatio);
    return { x, y: snap(height / 2) - half, width, height: half * 2 };
  });
}

function paintBars(painter: Painter, from: number, to: number, headX: number): void {
  const { context, bars } = painter;
  if (!context) return;
  for (let index = Math.max(0, from); index <= Math.min(bars.length - 1, to); index++) {
    const bar = bars[index];
    const radius = Math.min(bar.width / 2, 1.5);
    context.clearRect(bar.x, 0, bar.width, context.canvas.height);
    context.fillStyle = painter.idle;
    context.beginPath();
    context.roundRect(bar.x, bar.y, bar.width, bar.height, radius);
    context.fill();
    const playedWidth = Math.min(bar.width, headX - bar.x);
    if (playedWidth <= 0) continue;
    context.save();
    context.beginPath();
    context.rect(bar.x, 0, playedWidth, context.canvas.height);
    context.clip();
    context.fillStyle = painter.played;
    context.beginPath();
    context.roundRect(bar.x, bar.y, bar.width, bar.height, radius);
    context.fill();
    context.restore();
  }
}

// -- Components ---------------------------------------------------------------

// Its own component so the 4 Hz time updates re-render only the slider, never the canvas owner.
const SeekOverlay: React.FC<{ duration: number }> = ({ duration }) => {
  const currentTime = useAudioStore((state) => state.currentTime);
  const seekTo = useAudioStore((state) => state.seekTo);
  return (
    <Slider
      appearance="overlay"
      value={currentTime}
      min={0}
      max={duration}
      onChange={seekTo}
      aria-label="Audio progress"
      className="absolute! inset-x-2 inset-y-0"
    />
  );
};

const OverviewScrub: React.FC = () => {
  const envelope = useLevelEnvelope();
  const duration = useAudioStore((state) => state.duration);
  const themeId = useThemeStore((state) => state.activeThemeId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const idleProbeRef = useRef<HTMLSpanElement>(null);
  const playedProbeRef = useRef<HTMLSpanElement>(null);
  const painter = useRef<Painter>({ context: null, bars: [], width: 0, headBar: -1, idle: "", played: "" }).current;

  const moveHead = () => {
    if (duration <= 0 || painter.width <= 0) return;
    const headX = (livePlaybackTime() / duration) * painter.width;
    if (headRef.current) headRef.current.style.translate = `${headX - 1}px 0`;
    const headBar = Math.floor(headX / BAR_PITCH);
    if (painter.headBar < 0) paintBars(painter, 0, painter.bars.length - 1, headX);
    else paintBars(painter, Math.min(painter.headBar, headBar) - 1, Math.max(painter.headBar, headBar) + 1, headX);
    painter.headBar = headBar;
  };

  useLayoutEffect(() => {
    void themeId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      const context = canvas.getContext("2d");
      context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      painter.context = context;
      painter.width = width;
      painter.idle = idleProbeRef.current ? getComputedStyle(idleProbeRef.current).color : "";
      painter.played = playedProbeRef.current ? getComputedStyle(playedProbeRef.current).color : "";
      painter.bars = envelope
        ? layoutBars(bucketPeaks(envelope, Math.floor(width / BAR_PITCH)), height, pixelRatio)
        : [];
      painter.headBar = -1;
      context?.clearRect(0, 0, width, height);
      moveHead();
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  });

  useFrameLoop(moveHead, "deck-overview-head");

  return (
    <div className="relative flex-1 min-w-0 h-14 overflow-hidden rounded-xl bg-(--well) shadow-(--well-edge)">
      <span
        ref={idleProbeRef}
        aria-hidden="true"
        className="hidden text-[color-mix(in_oklab,var(--color-composer-wave)_55%,var(--well))]"
      />
      <span ref={playedProbeRef} aria-hidden="true" className="hidden text-composer-accent" />
      <div className="absolute inset-x-2 inset-y-1.5 pointer-events-none">
        <SeekBarFocusBand duration={duration} />
      </div>
      <div
        aria-hidden="true"
        data-loaded={envelope ? "" : undefined}
        data-sweeping={envelope ? undefined : ""}
        className="absolute inset-x-2 inset-y-1.5 overflow-hidden rounded-lg waveform-loading-dots pointer-events-none transition-opacity duration-200 ease-out data-loaded:opacity-0"
      />
      <canvas
        ref={canvasRef}
        data-loaded={envelope ? "" : undefined}
        className="absolute inset-x-2 inset-y-2 size-[calc(100%-16px)] opacity-0 transition-opacity duration-150 ease-in data-loaded:opacity-100"
      />
      <div
        ref={headRef}
        aria-hidden="true"
        // react-doctor-disable-next-line react-doctor/no-permanent-will-change -- moved by the frame loop every frame while playing or scrolling, so it needs its own compositor layer
        className="absolute left-2 inset-y-1.5 w-0.5 rounded-[1px] bg-composer-accent will-change-[translate] pointer-events-none"
      />
      <SeekOverlay duration={duration} />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { OverviewScrub };
