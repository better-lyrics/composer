import { type BeatGrid, barNumberAt, beatIndexAt, beatTime, isDownbeat } from "@/domain/tempo/beat-grid";
import { tempoStats } from "@/domain/tempo/tempo-stats";

// -- Types ---------------------------------------------------------------------

type GridLines = "bar" | "1" | "2" | "3" | "4";
type GridPointKind = "bar" | "beat" | "sub";

interface GridPoint {
  t: number;
  kind: GridPointKind;
  bar: number;
  division: number;
}

interface GridDensity {
  beats: boolean;
  division: number;
  thinned: boolean;
}

// -- Constants -----------------------------------------------------------------

const MIN_SUBDIVISION_PX = 14;
const MIN_BEAT_PX = 10;
const SAME_TIME_SECONDS = 1e-6;

// -- Helpers -------------------------------------------------------------------

function reducedDenominator(numerator: number, denominator: number): number {
  let a = numerator;
  let b = denominator;
  while (b) [a, b] = [b, a % b];
  return denominator / a;
}

// -- Density -------------------------------------------------------------------

function gridDensity(grid: BeatGrid, pxPerSecond: number, lines: GridLines): GridDensity {
  const requested = lines === "bar" ? 0 : Number(lines);
  const bpm = tempoStats(grid)?.bpm ?? 0;
  const beatPx = bpm > 0 ? (60 / bpm) * pxPerSecond : 0;
  const beats = requested >= 1 && beatPx >= MIN_BEAT_PX;
  const division = requested >= 2 && beats && beatPx / requested >= MIN_SUBDIVISION_PX ? requested : 1;
  const shown = beats ? division : 0;
  return { beats, division, thinned: shown < requested };
}

// -- Points --------------------------------------------------------------------

function gridPoints(grid: BeatGrid, t0: number, t1: number, pxPerSecond: number, lines: GridLines): GridPoint[] {
  if (grid.beats.length === 0) return [];
  const density = gridDensity(grid, pxPerSecond, lines);
  const points: GridPoint[] = [];
  const last = grid.beats.length - 1;
  for (let i = Math.max(0, beatIndexAt(grid, t0)); i <= last; i++) {
    const t = beatTime(grid, i);
    if (t > t1) break;
    const bar = barNumberAt(grid, i);
    if (isDownbeat(grid, i)) points.push({ t, kind: "bar", bar, division: 1 });
    else if (density.beats) points.push({ t, kind: "beat", bar, division: 1 });
    if (!density.beats || density.division < 2 || i === last) continue;
    const step = (beatTime(grid, i + 1) - t) / density.division;
    for (let k = 1; k < density.division; k++) {
      points.push({ t: t + step * k, kind: "sub", bar, division: reducedDenominator(k, density.division) });
    }
  }
  return points;
}

function gridPointLabel(point: GridPoint): string {
  if (point.kind === "bar") return `Bar ${point.bar}`;
  if (point.kind === "beat") return "Beat";
  return `1/${point.division}`;
}

function gridPointAt(points: readonly GridPoint[], time: number): GridPoint | null {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < time - SAME_TIME_SECONDS) lo = mid + 1;
    else hi = mid;
  }
  const point = points[lo];
  return point && Math.abs(point.t - time) <= SAME_TIME_SECONDS ? point : null;
}

// -- Exports -------------------------------------------------------------------

export { gridDensity, gridPointAt, gridPointLabel, gridPoints };
export type { GridLines, GridPoint, GridPointKind };
