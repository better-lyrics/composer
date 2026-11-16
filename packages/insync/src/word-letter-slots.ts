// -- Functions ----------------------------------------------------------------

// Consecutive slots dividing begin to end, each part's share set by its letters; the last slot ends exactly at `end`.
function letterSlots(letters: readonly number[], begin: number, end: number): { begin: number; end: number }[] {
  const total = letters.reduce((sum, count) => sum + count, 0);
  let from = begin;
  return letters.map((count, index) => {
    const to = index === letters.length - 1 ? end : from + ((end - begin) * count) / total;
    const slot = { begin: from, end: to };
    from = to;
    return slot;
  });
}

// -- Exports ------------------------------------------------------------------

export { letterSlots };
