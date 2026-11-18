// -- Types ---------------------------------------------------------------------

type NearestAccepted = <T>(target: number, accept: (index: number) => T | null) => { index: number; value: T } | null;

// -- Functions -----------------------------------------------------------------

// A search over ascending `indexes` for the first non-null `accept` result walking outward from a target, nearest
// first and the lower index on a tie. An index `isGone` reports never comes back, so every search skips it in near
// constant time instead of testing it again.
function nearestAcceptedSearch(indexes: readonly number[], isGone: (index: number) => boolean): NearestAccepted {
  const rightOf = indexes.map((_, position) => position);
  const leftOf = indexes.map((_, position) => position);
  const live = (links: number[], start: number, step: 1 | -1): number => {
    let position = start;
    while (position >= 0 && position < indexes.length && links[position] !== position) position = links[position];
    while (position >= 0 && position < indexes.length && isGone(indexes[position])) {
      links[position] = position + step;
      position += step;
      while (position >= 0 && position < indexes.length && links[position] !== position) position = links[position];
    }
    for (let at = start; at >= 0 && at < indexes.length && at !== position; ) {
      const next = links[at];
      links[at] = position;
      at = next;
    }
    return position;
  };
  return (target, accept) => {
    let low = 0;
    let high = indexes.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (indexes[middle] < target) low = middle + 1;
      else high = middle;
    }
    let left = live(leftOf, low - 1, -1);
    let right = live(rightOf, low, 1);
    while (left >= 0 || right < indexes.length) {
      const takeLeft = left >= 0 && (right >= indexes.length || target - indexes[left] <= indexes[right] - target);
      const position = takeLeft ? left : right;
      const value = accept(indexes[position]);
      if (value !== null) return { index: indexes[position], value };
      if (takeLeft) left = live(leftOf, left - 1, -1);
      else right = live(rightOf, right + 1, 1);
    }
    return null;
  };
}

// -- Exports -------------------------------------------------------------------

export type { NearestAccepted };
export { nearestAcceptedSearch };
