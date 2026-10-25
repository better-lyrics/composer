import type { BeatGrid } from "@/domain/tempo/beat-grid";
import { type GridLines, type GridPointKind, gridPoints } from "@/domain/tempo/grid-points";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { livePlaybackTime } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useRef } from "react";

// -- Types ---------------------------------------------------------------------

interface GridColours extends Record<GridPointKind, string> {
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

const BAR_NUMBER_FONT = `500 9.5px "Geist Mono", ui-monospace, monospace`;
const BAR_NUMBER_INSET_X = 4;
const BAR_NUMBER_Y = 7;
const SHORT_LINE_INSET = 4;
const BAR_NUMBER_REACH_PX = 32;
// The spectrum is a dark display in every theme, so lines over it are white, not theme ink.
const SPECTRUM_GRID_COLOURS: GridColours = {
  bar: "rgba(255, 255, 255, 0.34)",
  beat: "rgba(255, 255, 255, 0.15)",
  sub: "rgba(255, 255, 255, 0.08)",
  number: "rgba(255, 255, 255, 0.72)",
};
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
    sub: ink(12),
    number: resolveColour("var(--color-composer-text-tertiary)"),
  };
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
  context.font = BAR_NUMBER_FONT;
  context.textBaseline = "middle";
  let labelEnd = Number.NEGATIVE_INFINITY;
  for (const point of gridPoints(grid, t0, t1, zoom, lines)) {
    const x = Math.round(point.t * zoom - scrollLeft) + 0.5;
    const isBar = point.kind === "bar";
    context.fillStyle = colours[point.kind];
    context.fillRect(x - 0.5, isBar ? 0 : SHORT_LINE_INSET, 1, isBar ? height : height - SHORT_LINE_INSET * 2);
    const labelX = x + BAR_NUMBER_INSET_X;
    if (!isBar || labelX < labelEnd) continue;
    const label = String(point.bar);
    context.save();
    if (state.overSpectrum) {
      context.shadowColor = NUMBER_SHADOW.colour;
      context.shadowBlur = NUMBER_SHADOW.blur;
    }
    context.fillStyle = colours.number;
    context.fillText(label, labelX, BAR_NUMBER_Y);
    context.restore();
    labelEnd = labelX + context.measureText(label).width + BAR_NUMBER_INSET_X * 2;
  }
}

// -- Component -----------------------------------------------------------------

const BeatGridCanvas: React.FC = () => {
  const visible = useSettingsStore((s) => s.beatGridVisible);
  const hasGrid = useProjectStore((s) => s.beatGrid !== null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawnRef = useRef<DrawnState | null>(null);
  const coloursRef = useRef<ResolvedColours | null>(null);
  const enabled = visible && hasGrid;

  useFrameLoop(
    () => {
      const canvas = canvasRef.current;
      const container = canvas?.closest<HTMLElement>("[data-scroll-container]");
      const band = canvas?.parentElement;
      if (!canvas || !container || !band) return;
      const grid = useProjectStore.getState().beatGrid;
      const { activeThemeId, customThemes } = useThemeStore.getState();
      const next: DrawnState = {
        canvas,
        scrollLeft: Math.round(container.scrollLeft),
        zoom: useTimelineStore.getState().zoom,
        width: Math.max(0, container.clientWidth - GUTTER_WIDTH),
        height: band.clientHeight,
        pixelRatio: window.devicePixelRatio || 1,
        grid,
        lines: useSettingsStore.getState().beatGridLines,
        themeId: activeThemeId,
        customThemes,
        overSpectrum: useTimelineStore.getState().spectrumVisible,
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
    <div aria-hidden="true" className="absolute inset-x-0 top-0 bottom-px overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} data-beat-grid-canvas className="absolute top-0 left-0 beat-grid-past-dim" />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { BeatGridCanvas };
