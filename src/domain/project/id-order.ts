// -- Comparators --------------------------------------------------------------

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// -- Exports ------------------------------------------------------------------

export { compareIds };
