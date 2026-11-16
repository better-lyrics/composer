// -- Functions -----------------------------------------------------------------

// The first non-null `accept` result walking outward from `target` over ascending `indexes`, nearest first and the
// lower index on a tie, so a search stops at the nearest match instead of testing every index.
function nearestAccepted<T>(
  indexes: readonly number[],
  target: number,
  accept: (index: number) => T | null,
): { index: number; value: T } | null {
  let low = 0;
  let high = indexes.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (indexes[middle] < target) low = middle + 1;
    else high = middle;
  }
  let left = low - 1;
  let right = low;
  while (left >= 0 || right < indexes.length) {
    const takeLeft = left >= 0 && (right >= indexes.length || target - indexes[left] <= indexes[right] - target);
    const index = takeLeft ? indexes[left--] : indexes[right++];
    const value = accept(index);
    if (value !== null) return { index, value };
  }
  return null;
}

// -- Exports -------------------------------------------------------------------

export { nearestAccepted };
