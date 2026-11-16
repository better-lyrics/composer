import { msFromSeconds } from "./time";

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

// Slots for typed texts, shared by letters (at least one each) at whole milliseconds, so every part exports at least
// one millisecond; null when the span cannot give every part one.
function textSlots(texts: readonly string[], begin: number, end: number): { begin: number; end: number }[] | null {
  const from = msFromSeconds(begin);
  const spare = msFromSeconds(end) - from - texts.length;
  if (spare < 0) return null;
  const letters = texts.map((text) => Math.max(1, text.trim().length));
  const total = letters.reduce((sum, count) => sum + count, 0);
  let reached = 0;
  let previous = begin;
  return letters.map((count, index) => {
    reached += count;
    const boundary =
      index === letters.length - 1 ? end : (from + index + 1 + Math.round((spare * reached) / total)) / 1000;
    const slot = { begin: previous, end: boundary };
    previous = boundary;
    return slot;
  });
}

// -- Exports ------------------------------------------------------------------

export { letterSlots, textSlots };
