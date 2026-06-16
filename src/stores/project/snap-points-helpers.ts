function normalizeSnapPoints(points: number[]): number[] {
  return points.filter((point) => Number.isFinite(point) && point >= 0).toSorted((a, b) => a - b);
}

export { normalizeSnapPoints };
