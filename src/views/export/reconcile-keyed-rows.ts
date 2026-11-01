import { nanoid } from "nanoid";

// -- Reconciliation -----------------------------------------------------------

// Editable lists are rendered from rows carrying a stable id, so React keys
// survive edits. Reconciling by position keeps a row's id whenever its content
// is unchanged and mints one only where the external value actually differs.
function reconcileKeyedRows<Row extends { id: string }, Source>(
  previous: Row[],
  sources: Source[],
  matches: (row: Row, source: Source) => boolean,
  create: (id: string, source: Source) => Row,
): Row[] {
  return sources.map((source, index) => {
    const existing = previous[index];
    if (existing && matches(existing, source)) return existing;
    return create(existing?.id ?? nanoid(), source);
  });
}

// -- Exports ------------------------------------------------------------------

export { reconcileKeyedRows };
