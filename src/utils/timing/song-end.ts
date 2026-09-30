// -- Functions ----------------------------------------------------------------

function songEndOrUnbounded(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? duration : Number.POSITIVE_INFINITY;
}

// -- Exports ------------------------------------------------------------------

export { songEndOrUnbounded };
