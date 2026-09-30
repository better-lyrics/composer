// -- Helpers ------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// -- Comparison ---------------------------------------------------------------

function isStructurallyEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => isStructurallyEqual(item, b[index]))
    );
  }
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!isStructurallyEqual(a[key], b[key])) return false;
  }
  return true;
}

// -- Exports ------------------------------------------------------------------

export { isStructurallyEqual };
