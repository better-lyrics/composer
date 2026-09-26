// -- Guards -------------------------------------------------------------------

function hasUsableDuration(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// -- Normalization ------------------------------------------------------------

// Providers hand this untrusted JSON, so anything that is not a usable duration becomes undefined
// rather than reaching a reader as NaN or 0.
function toUsableDurationSec(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  const rounded = Math.round(value);
  return hasUsableDuration(rounded) ? rounded : undefined;
}

// -- Exports ------------------------------------------------------------------

export { hasUsableDuration, toUsableDurationSec };
