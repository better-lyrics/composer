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

// Slots for typed texts, each sharing by its letters and never by less than one.
function textSlots(texts: readonly string[], begin: number, end: number): { begin: number; end: number }[] {
  return letterSlots(
    texts.map((text) => Math.max(1, text.trim().length)),
    begin,
    end,
  );
}

// -- Exports ------------------------------------------------------------------

export { letterSlots, textSlots };
