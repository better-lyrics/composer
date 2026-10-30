import { pitchRangeBetween } from "@/domain/pitch/line-range";
import type { PitchTrack } from "@/domain/pitch/track";
import { voicedRuns } from "@/domain/pitch/voiced-runs";
import { LOUPE_FIXED, type LoupeSize } from "@/domain/spectrum/loupe-size";
import type { BeatGrid } from "@/domain/tempo/beat-grid";
import { type GridLines, gridPoints } from "@/domain/tempo/grid-points";
import type { Bounds } from "@/domain/word/bounds";
import { formatTime } from "@/utils/format-time";
import { CANVAS_MONO_LABEL_FONT } from "@/views/timeline/canvas-fonts";

// -- Types --------------------------------------------------------------------

interface LoupeCanvas {
  width: number;
  height: number;
  spectrumHeight: number;
  rulerHeight: number;
}

interface LoupeFrame {
  context: CanvasRenderingContext2D;
  canvas: LoupeCanvas;
  styles: CSSStyleDeclaration;
  originX: number;
  pixelsPerSecond: number;
}

// -- Constants ----------------------------------------------------------------

const LOUPE_ZOOM = 3;
const RULER_TICK_SECONDS = 0.05;
const BEAT_STRENGTH = { bar: 0.4, beat: 0.2, sub: 0.09 } as const;
const PITCH_INSET = 12;

// -- Helpers ------------------------------------------------------------------

function loupeCanvas(size: LoupeSize): LoupeCanvas {
  return {
    width: size.width,
    spectrumHeight: size.height,
    rulerHeight: LOUPE_FIXED.rulerHeight,
    height: size.height + LOUPE_FIXED.rulerHeight + LOUPE_FIXED.lanesHeight,
  };
}

function xOf(frame: LoupeFrame, seconds: number): number {
  return Math.round(seconds * frame.pixelsPerSecond - frame.originX);
}

function visibleSpan(frame: LoupeFrame): Bounds {
  return {
    begin: frame.originX / frame.pixelsPerSecond,
    end: (frame.originX + frame.canvas.width) / frame.pixelsPerSecond,
  };
}

function colour(frame: LoupeFrame, name: string): string {
  return frame.styles.getPropertyValue(name).trim();
}

// -- Drawing ------------------------------------------------------------------

function drawLoupeRuler(frame: LoupeFrame): void {
  const { context } = frame;
  const top = frame.canvas.spectrumHeight;
  const height = frame.canvas.rulerHeight;
  context.fillStyle = colour(frame, "--color-composer-bg-dark");
  context.fillRect(0, top, frame.canvas.width, height);
  context.fillStyle = colour(frame, "--divider");
  context.fillRect(0, top + height - 1, frame.canvas.width, 1);
  const span = visibleSpan(frame);
  const labelEvery = frame.pixelsPerSecond * 0.25 >= 64 ? 0.25 : 0.5;
  const faint = colour(frame, "--color-composer-text-faint");
  const label = colour(frame, "--color-composer-text-tertiary");
  context.font = CANVAS_MONO_LABEL_FONT;
  context.textBaseline = "middle";
  context.textAlign = "left";
  for (let tick = Math.ceil(span.begin / RULER_TICK_SECONDS); tick <= span.end / RULER_TICK_SECONDS; tick++) {
    const seconds = tick * RULER_TICK_SECONDS;
    const x = xOf(frame, seconds) + 0.5;
    const labelled = Math.abs(seconds / labelEvery - Math.round(seconds / labelEvery)) < 1e-6;
    const tickHeight = labelled ? 7 : 3;
    context.fillStyle = faint;
    context.fillRect(x - 0.5, top + height - tickHeight - 1, 1, tickHeight);
    if (!labelled || seconds < 0) continue;
    context.fillStyle = label;
    context.fillText(formatTime(seconds, 2), x + 4, top + 7);
  }
}

// Beat marks hang from the ruler's top so they stay distinct from the time ticks rising from its floor.
function drawLoupeBeats(frame: LoupeFrame, grid: BeatGrid, lines: GridLines): void {
  const { context } = frame;
  const span = visibleSpan(frame);
  const top = frame.canvas.spectrumHeight;
  const mark = colour(frame, "--color-composer-text-tertiary");
  for (const point of gridPoints(grid, span.begin, span.end, frame.pixelsPerSecond, lines)) {
    const x = xOf(frame, point.t);
    context.fillStyle = `rgba(255, 255, 255, ${BEAT_STRENGTH[point.kind]})`;
    context.fillRect(x, 0, 1, top);
    if (point.kind === "sub") continue;
    context.fillStyle = mark;
    context.globalAlpha = point.kind === "bar" ? 1 : 0.6;
    context.beginPath();
    context.roundRect(x - 1, top, 2, point.kind === "bar" ? 7 : 4, [0, 0, 1, 1]);
    context.fill();
    context.globalAlpha = 1;
  }
}

function drawLoupePitch(frame: LoupeFrame, track: PitchTrack, lineSpan: Bounds): void {
  const { context } = frame;
  const span = visibleSpan(frame);
  const { low, high } = pitchRangeBetween(track, lineSpan.begin, lineSpan.end);
  const top = PITCH_INSET;
  const bottom = frame.canvas.spectrumHeight - PITCH_INSET;
  const yOf = (semitones: number) =>
    bottom - ((Math.min(high, Math.max(low, semitones)) - low) / (high - low)) * (bottom - top);
  context.save();
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = "rgba(0, 0, 0, 0.8)";
  context.shadowBlur = 3;
  context.beginPath();
  for (const run of voicedRuns(track, span.begin, span.end)) {
    run.forEach((point, index) => {
      const x = point.seconds * frame.pixelsPerSecond - frame.originX;
      if (index === 0) context.moveTo(x, yOf(point.semitones));
      else context.lineTo(x, yOf(point.semitones));
    });
  }
  context.stroke();
  context.restore();
}

function drawLoupePlayhead(frame: LoupeFrame, seconds: number): void {
  const x = xOf(frame, seconds);
  if (x < -2 || x > frame.canvas.width + 2) return;
  frame.context.fillStyle = colour(frame, "--color-composer-accent");
  frame.context.fillRect(x - 1, 0, 2, frame.canvas.height);
}

// The edited edge runs the full height: white over the spectrum, ink over the lanes.
function drawLoupeEdge(frame: LoupeFrame, seconds: number): void {
  const { context } = frame;
  const x = xOf(frame, seconds);
  const spectrumHeight = frame.canvas.spectrumHeight;
  context.fillStyle = "#ffffff";
  context.fillRect(x - 1, 0, 2, spectrumHeight);
  context.fillStyle = colour(frame, "--color-composer-text");
  context.fillRect(x - 1, spectrumHeight, 2, frame.canvas.height - spectrumHeight);
  context.beginPath();
  context.roundRect(x - 4, spectrumHeight + 3, 8, frame.canvas.rulerHeight - 6, 2);
  context.fill();
}

// -- Exports ------------------------------------------------------------------

export {
  LOUPE_ZOOM,
  colour,
  drawLoupeBeats,
  drawLoupeEdge,
  drawLoupePitch,
  drawLoupePlayhead,
  drawLoupeRuler,
  loupeCanvas,
  xOf,
};
export type { LoupeCanvas, LoupeFrame };
