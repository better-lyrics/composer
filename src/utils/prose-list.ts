// -- Constants ----------------------------------------------------------------

const PROSE_LIST_FORMATTER = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

// -- Functions ----------------------------------------------------------------

function proseList(items: readonly string[]): string {
  return PROSE_LIST_FORMATTER.format(items);
}

// -- Exports ------------------------------------------------------------------

export { proseList };
