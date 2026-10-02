// -- Constants -----------------------------------------------------------------

const FLOAT_TOLERANCE = 1e-9;

// -- Helpers ------------------------------------------------------------------

function formatCountdown(remainingSeconds: number, precision: 0 | 1): string {
  const clamped = Math.max(0, remainingSeconds);
  if (precision === 0) return String(Math.ceil(clamped - FLOAT_TOLERANCE));
  return (Math.ceil(clamped * 10 - FLOAT_TOLERANCE) / 10).toFixed(1);
}

// -- Exports -------------------------------------------------------------------

export { formatCountdown };
