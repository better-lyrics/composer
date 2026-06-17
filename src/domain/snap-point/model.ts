import { nanoid } from "nanoid";

// -- Types --------------------------------------------------------------------

interface SnapPoint {
  id: string;
  time: number;
}

// -- Functions ----------------------------------------------------------------

function createSnapPoint(time: number): SnapPoint {
  return { id: nanoid(8), time };
}

function hasValidId(point: SnapPoint): boolean {
  return typeof point.id === "string" && point.id.length > 0;
}

function toSnapPoints(points: ReadonlyArray<SnapPoint | number>): SnapPoint[] {
  return points.map((point) => {
    if (typeof point === "number") return createSnapPoint(point);
    if (hasValidId(point)) return { id: point.id, time: point.time };
    return { id: nanoid(8), time: point.time };
  });
}

function snapPointTimes(points: ReadonlyArray<SnapPoint>): number[] {
  return points.map((point) => point.time);
}

function normalizeTimes(times: ReadonlyArray<number>): number[] {
  return times.filter((time) => Number.isFinite(time) && time >= 0).toSorted((a, b) => a - b);
}

function normalizeSnapPoints(points: ReadonlyArray<SnapPoint | number>): SnapPoint[] {
  return toSnapPoints(points)
    .filter((point) => Number.isFinite(point.time) && point.time >= 0)
    .toSorted((a, b) => a.time - b.time);
}

// -- Exports ------------------------------------------------------------------

export { createSnapPoint, normalizeSnapPoints, normalizeTimes, snapPointTimes, toSnapPoints };
export type { SnapPoint };
