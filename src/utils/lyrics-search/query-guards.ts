// -- Guards -------------------------------------------------------------------

function hasNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUsableDuration(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// -- Exports ------------------------------------------------------------------

export { hasNonEmptyString, hasUsableDuration };
