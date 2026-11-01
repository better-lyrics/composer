// -- Intervals -----------------------------------------------------------------

function beatIntervals(beats: readonly number[]): number[] {
  return beats.slice(1).map((time, i) => time - beats[i]);
}

function median(values: readonly number[]): number {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
}

// -- Exports -------------------------------------------------------------------

export { beatIntervals, median };
