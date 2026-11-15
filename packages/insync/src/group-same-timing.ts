// -- Constants ----------------------------------------------------------------

const SAME_TIMING_TOLERANCE_SECONDS = 0.01;

// -- Functions ----------------------------------------------------------------

function sameTime(a: number | undefined, b: number | undefined, offset = 0): boolean {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a + offset - b) <= SAME_TIMING_TOLERANCE_SECONDS;
}

// -- Exports ------------------------------------------------------------------

export { sameTime };
