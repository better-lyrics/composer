import type { BeatGrid } from "@/domain/tempo/beat-grid";
import { type GridLines, type GridPoint, gridPoints } from "@/domain/tempo/grid-points";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { cn } from "@/utils/cn";
import { useBandEmpty } from "@/views/timeline/band-empty";
import { CANVAS_MONO_LABEL_FONT } from "@/views/timeline/canvas-fonts";
import { STRIP_SCREENS, type Strip, stripFor } from "@/views/timeline/scroll-window";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useRef } from "react";
import { viewScrollLeft } from "@/views/timeline/view-scroll";

// -- Types ---------------------------------------------------------------------

type GridLineLevel = "bar" | "beat" | "half" | "fine";

interface GridColours extends Record<GridLineLevel, string> {
  number: string;
}

interface DrawnState {
  canvas: HTMLCanvasElement;
  scrollLeft: number;
  zoom: number;
  width: number;
  height: number;
  pixelRatio: number;
  grid: BeatGrid | null;
  lines: GridLines;
  themeId: string;
  customThemes: readonly unknown[];
  overSpectrum: boolean;
}

interface ResolvedColours {
  themeId: string;
  customThemes: readonly unknown[];
  colours: GridColours;
}

// -- Constants -----------------------------------------------------------------

const BAR_NUMBER_INSET_X = 4;
const BAR_NUMBER_Y = 7;
const SHORT_LINE_INSET = 4;
const SPECTRUM_LINE_LENGTH: Record<GridLineLevel, number> = { bar: 1, beat: 0.6, half: 0.36, fine: 0.2 };
const BAR_NUMBER_REACH_PX = 32;
// The spectrum is a dark display in every theme, so lines over it are white, not theme ink.
const SPECTRUM_GRID_COLOURS: GridColours = {
  bar: "rgba(255, 255, 255, 0.62)",
  beat: "rgba(255, 255, 255, 0.58)",
  half: "rgba(255, 255, 255, 0.54)",
  fine: "rgba(255, 255, 255, 0.5)",
  number: "rgba(255, 255, 255, 0.72)",
};
const SPECTRUM_LINE_EDGE = "rgba(0, 0, 0, 0.55)";
const NUMBER_SHADOW = { colour: "rgba(0, 0, 0, 0.85)", blur: 3 };

// -- Helpers -------------------------------------------------------------------

function resolveColour(css: string): string {
  const probe = document.createElement("span");
  probe.style.color = css;
  document.body.appendChild(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

function resolveGridColours(): GridColours {
  const ink = (percent: number) =>
    resolveColour(`color-mix(in oklab, var(--color-composer-text) ${percent}%, transparent)`);
  return {
    bar: ink(36),
    beat: ink(22),
    half: ink(12),
    fine: ink(12),
    number: resolveColour("var(--color-composer-text-tertiary)"),
  };
}

function lineLevel(point: GridPoint): GridLineLevel {
  if (point.kind !== "sub") return point.kind;
  return point.division === 2 ? "half" : "fine";
}

function lineX(point: GridPoint, state: DrawnState): number {
  return Math.round(point.t * state.zoom - state.scrollLeft) + 0.5;
}

function lineTop(level: GridLineLevel, overSpectrum: boolean): number {
  return overSpectrum || level === "bar" ? 0 : SHORT_LINE_INSET;
}

function lineLength(level: GridLineLevel, height: number, overSpectrum: boolean): number {
  if (overSpectrum) return Math.round(height * SPECTRUM_LINE_LENGTH[level]);
  return level === "bar" ? height : height - SHORT_LINE_INSET * 2;
}

function isSameDrawing(a: DrawnState, b: DrawnState): boolean {
  return (
    a.canvas === b.canvas &&
    a.scrollLeft === b.scrollLeft &&
    a.zoom === b.zoom &&
    a.width === b.width &&
    a.height === b.height &&
    a.pixelRatio === b.pixelRatio &&
    a.grid === b.grid &&
    a.lines === b.lines &&
    a.themeId === b.themeId &&
    a.customThemes === b.customThemes &&
    a.overSpectrum === b.overSpectrum
  );
}

function paintGrid(context: CanvasRenderingContext2D, grid: BeatGrid, state: DrawnState, colours: GridColours): void {
  const { scrollLeft, zoom, width, height, lines } = state;
  const t0 = (scrollLeft - BAR_NUMBER_REACH_PX) / zoom;
  const t1 = (scrollLeft + width + 1) / zoom;
  const points = gridPoints(grid, t0, t1, zoom, lines);
  for (const point of points) {
    const x = lineX(point, state);
    const level = lineLevel(point);
    const top = lineTop(level, state.overSpectrum);
    const length = lineLength(level, height, state.overSpectrum);
    if (state.overSpectrum) {
      context.fillStyle = SPECTRUM_LINE_EDGE;
      context.fillRect(x - 1.5, top, 3, length);
    }
    context.fillStyle = colours[level];
    context.fillRect(x - 0.5, top, 1, length);
  }
  paintBarNumbers(context, points, state, colours.number);
}

function paintBarNumbers(
  context: CanvasRenderingContext2D,
  points: readonly GridPoint[],
  state: DrawnState,
  colour: string,
): void {
  context.save();
  context.font = CANVAS_MONO_LABEL_FONT;
  context.textBaseline = "middle";
  context.fillStyle = colour;
  if (state.overSpectrum) {
    context.shadowColor = NUMBER_SHADOW.colour;
    context.shadowBlur = NUMBER_SHADOW.blur;
  }
  let labelEnd = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.kind !== "bar") continue;
    const labelX = lineX(point, state) + BAR_NUMBER_INSET_X;
    if (labelX < labelEnd) continue;
    const label = String(point.bar);
    context.fillText(label, labelX, BAR_NUMBER_Y);
    labelEnd = labelX + context.measureText(label).width + BAR_NUMBER_INSET_X * 2;
  }
  context.restore();
}

// -- Component -----------------------------------------------------------------

const BeatGridCanvas: React.FC = () => {
  const visible = useSettingsStore((s) => s.beatGridVisible);
  const hasGrid = useProjectStore((s) => s.beatGrid !== null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawnRef = useRef<DrawnState | null>(null);
  const coloursRef = useRef<ResolvedColours | null>(null);
  const stripRef = useRef<Strip | null>(null);
  const enabled = visible && hasGrid;
  const bandEmpty = useBandEmpty();

  useFrameLoop(
    () => {
      const canvas = canvasRef.current;
      const container = canvas?.closest<HTMLElement>("[data-scroll-container]");
      const band = canvas?.parentElement;
      if (!canvas || !container || !band) return;
      const grid = useProjectStore.getState().beatGrid;
      const { activeThemeId, customThemes } = useThemeStore.getState();
      const zoom = useTimelineStore.getState().zoom;
      const strip = stripFor(
        stripRef.current,
        viewScrollLeft(),
        Math.max(0, container.clientWidth - GUTTER_WIDTH),
        useAudioStore.getState().duration * zoom,
        STRIP_SCREENS,
      );
      stripRef.current = strip;
      const next: DrawnState = {
        canvas,
        scrollLeft: strip.start,
        zoom,
        width: strip.width,
        height: band.clientHeight,
        pixelRatio: window.devicePixelRatio || 1,
        grid,
        lines: useSettingsStore.getState().beatGridLines,
        themeId: activeThemeId,
        customThemes,
        overSpectrum: useSettingsStore.getState().showSpectrum,
      };
      const playedX = `${Math.round(livePlaybackTime() * next.zoom - next.scrollLeft)}px`;
      if (canvas.style.getPropertyValue("--played-x") !== playedX) canvas.style.setProperty("--played-x", playedX);
      const drawn = drawnRef.current;
      if (drawn && isSameDrawing(drawn, next)) return;
      drawnRef.current = next;

      canvas.style.transform = `translate3d(${next.scrollLeft}px, 0, 0)`;
      const pixelWidth = Math.round(next.width * next.pixelRatio);
      const pixelHeight = Math.round(next.height * next.pixelRatio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = `${next.width}px`;
        canvas.style.height = `${next.height}px`;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(next.pixelRatio, 0, 0, next.pixelRatio, 0, 0);
      context.clearRect(0, 0, next.width, next.height);
      if (!grid || next.zoom <= 0) return;
      let resolved = coloursRef.current;
      if (!resolved || resolved.themeId !== next.themeId || resolved.customThemes !== next.customThemes) {
        resolved = { themeId: next.themeId, customThemes, colours: resolveGridColours() };
        coloursRef.current = resolved;
      }
      paintGrid(context, grid, next, next.overSpectrum ? SPECTRUM_GRID_COLOURS : resolved.colours);
    },
    "beat-grid-canvas",
    enabled,
  );

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-x-0 top-0 bottom-px z-3 overflow-hidden pointer-events-none transition-opacity duration-200 ease-out",
        bandEmpty && "opacity-0",
      )}
    >
      <canvas ref={canvasRef} data-beat-grid-canvas className="absolute top-0 left-0 beat-grid-past-dim" />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { BeatGridCanvas };
