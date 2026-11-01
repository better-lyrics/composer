import { pitchLineKeyframes, pitchLineMotion } from "@/utils/animationVariants";
import type { PitchRange } from "@/domain/pitch/line-range";
import type { PitchPoint, PitchTrack } from "@/domain/pitch/track";
import { backgroundLaneRuns, voicedRuns } from "@/domain/pitch/voiced-runs";
import type { Rgb } from "@/domain/spectrum/palettes";
import type { Bounds } from "@/domain/word/bounds";
import { wordBlockWidth } from "@/views/timeline/row-geometry";

// -- Types ---------------------------------------------------------------------

type PitchLaneKind = "word" | "bg";

interface RibbonStyle {
  line: number;
  fill: number;
  width: number;
}

interface LaneWindow {
  left: number;
  width: number;
  height: number;
  zoom: number;
  range: PitchRange;
}

interface LaneWord extends Bounds {
  tick: boolean;
  selected: boolean;
}

interface LaneDrawing {
  window: LaneWindow;
  runs: readonly PitchPoint[][];
  words: readonly LaneWord[];
}

// -- Constants -----------------------------------------------------------------

const LANE_MARGIN_SECONDS = 0.6;
const BAND = { floorInset: 7, height: 10, pillInset: 5, radius: 10 } as const;
const WORD_STYLES = {
  idle: { line: 0.8, fill: 0.3, width: 1.5 },
  selected: { line: 1, fill: 0.4, width: 1.75 },
} as const satisfies Record<string, RibbonStyle>;
const SPILL_STYLE: RibbonStyle = { line: 0.95, fill: 0.32, width: 1.5 };
const LIT_STYLE: RibbonStyle = { line: 1, fill: 0.85, width: 2.25 };
const MAX_CANVAS_PX = 16384;

// -- Geometry ------------------------------------------------------------------

function laneWindow(lineBounds: Bounds, zoom: number, height: number, range: PitchRange): LaneWindow {
  return {
    left: Math.max(0, (lineBounds.begin - LANE_MARGIN_SECONDS) * zoom),
    width: Math.round((lineBounds.end - lineBounds.begin + 2 * LANE_MARGIN_SECONDS) * zoom),
    height,
    zoom,
    range,
  };
}

function bandOf(window: LaneWindow): { top: number; bottom: number } {
  const bottom = window.height - BAND.floorInset;
  return { top: bottom - BAND.height, bottom };
}

function xOf(window: LaneWindow, seconds: number): number {
  return seconds * window.zoom - window.left;
}

function yOf(window: LaneWindow, semitones: number): number {
  const { low, high } = window.range;
  const { top, bottom } = bandOf(window);
  return bottom - ((Math.min(high, Math.max(low, semitones)) - low) / (high - low)) * (bottom - top);
}

// -- Runs ----------------------------------------------------------------------

// A lane keeps the runs that touch its own words; the background lane shows pitch only where the lead is silent.
function laneRuns(
  track: PitchTrack,
  kind: PitchLaneKind,
  window: LaneWindow,
  words: readonly Bounds[],
  leadWords: readonly Bounds[],
): PitchPoint[][] {
  const touches = (run: PitchPoint[]) =>
    words.some((word) => run[run.length - 1].seconds >= word.begin && run[0].seconds < word.end);
  const runs = voicedRuns(track, window.left / window.zoom, (window.left + window.width) / window.zoom).filter(touches);
  return kind === "word" ? runs : backgroundLaneRuns(runs, leadWords);
}

// -- Drawing -------------------------------------------------------------------

function rgba([r, g, b]: Rgb, alpha: number): string {
  return `rgba(${r},${g},${b},${alpha})`;
}

function sizeCanvas(canvas: HTMLCanvasElement, window: LaneWindow): CanvasRenderingContext2D | null {
  const ratio = Math.min(globalThis.devicePixelRatio || 1, MAX_CANVAS_PX / Math.max(window.width, 1));
  canvas.width = Math.max(1, Math.round(window.width * ratio));
  canvas.height = Math.max(1, Math.round(window.height * ratio));
  canvas.style.left = `${window.left}px`;
  canvas.style.width = `${window.width}px`;
  canvas.style.height = `${window.height}px`;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
  return context;
}

// The contour is the top edge of a fill that fades from the contour down to the band floor.
function ribbon(
  context: CanvasRenderingContext2D,
  window: LaneWindow,
  runs: readonly PitchPoint[][],
  colour: Rgb,
  style: RibbonStyle,
): void {
  const { top, bottom } = bandOf(window);
  const gradient = context.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, rgba(colour, style.fill));
  gradient.addColorStop(1, rgba(colour, 0));
  context.fillStyle = gradient;
  for (const run of runs) {
    context.beginPath();
    context.moveTo(xOf(window, run[0].seconds), bottom);
    for (const point of run) context.lineTo(xOf(window, point.seconds), yOf(window, point.semitones));
    context.lineTo(xOf(window, run[run.length - 1].seconds), bottom);
    context.closePath();
    context.fill();
  }
  context.strokeStyle = rgba(colour, style.line);
  context.lineWidth = style.width;
  context.beginPath();
  for (const run of runs) {
    run.forEach((point, index) => {
      const x = xOf(window, point.seconds);
      const y = yOf(window, point.semitones);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
  }
  context.stroke();
}

function wordRibbons(
  context: CanvasRenderingContext2D,
  drawing: LaneDrawing,
  colour: Rgb,
  styleOf: (word: LaneWord) => RibbonStyle,
): void {
  const { window } = drawing;
  for (const word of drawing.words) {
    if (word.tick) continue;
    context.save();
    context.beginPath();
    context.roundRect(
      xOf(window, word.begin),
      BAND.pillInset,
      wordBlockWidth(word.begin, word.end, window.zoom),
      window.height - 2 * BAND.pillInset,
      BAND.radius,
    );
    context.clip();
    ribbon(context, window, drawing.runs, colour, styleOf(word));
    context.restore();
  }
}

function drawPitchLane(
  canvas: HTMLCanvasElement,
  drawing: LaneDrawing,
  spills: readonly PitchPoint[][],
  ink: Rgb,
  warning: Rgb,
): void {
  const context = sizeCanvas(canvas, drawing.window);
  if (!context) return;
  wordRibbons(context, drawing, ink, (word) => (word.selected ? WORD_STYLES.selected : WORD_STYLES.idle));
  ribbon(context, drawing.window, spills, warning, SPILL_STYLE);
}

// The sung layer: the same ribbons in accent, revealed behind the playhead by a clip, never repainted per frame.
function drawSungLane(canvas: HTMLCanvasElement, drawing: LaneDrawing, accent: Rgb): void {
  const context = sizeCanvas(canvas, drawing.window);
  if (context) wordRibbons(context, drawing, accent, () => LIT_STYLE);
}

// When an edit removes a spill, the old pixels fade out over the redraw, so amber eases to the singer colour.
function fadeOutSnapshot(canvas: HTMLCanvasElement, ghost: HTMLCanvasElement, durationMs: number): void {
  if (!canvas.width) return;
  ghost.width = canvas.width;
  ghost.height = canvas.height;
  ghost.style.left = canvas.style.left;
  ghost.style.width = canvas.style.width;
  ghost.style.height = canvas.style.height;
  ghost.getContext("2d")?.drawImage(canvas, 0, 0);
  ghost.animate(pitchLineKeyframes.fadeOut, { duration: durationMs, easing: pitchLineMotion.fadeEase });
}

// -- Exports -------------------------------------------------------------------

export { drawPitchLane, drawSungLane, fadeOutSnapshot, laneRuns, laneWindow };
export type { LaneWord, PitchLaneKind };
