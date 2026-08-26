// -- Guards -------------------------------------------------------------------

function hasNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// -- Exports ------------------------------------------------------------------

export { hasNonEmptyString };
