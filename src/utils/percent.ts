// -- Functions ----------------------------------------------------------------

/** Whole-number percent of `done` out of `total`, 0 while the total is unknown. */
function percent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

// -- Exports ------------------------------------------------------------------

export { percent };
