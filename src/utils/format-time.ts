const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;

function formatTime(seconds: number, precision: 0 | 2 | 3 = 3): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return precision === 0 ? "0:00" : `0:00.${"0".repeat(precision)}`;
  }
  const totalMs = Math.round(seconds * MS_PER_SECOND);
  const mins = Math.floor(totalMs / MS_PER_MINUTE);
  const secs = Math.floor((totalMs % MS_PER_MINUTE) / MS_PER_SECOND);
  const base = `${mins}:${secs.toString().padStart(2, "0")}`;
  if (precision === 0) return base;
  const fraction = Math.floor((totalMs % MS_PER_SECOND) / 10 ** (3 - precision));
  return `${base}.${fraction.toString().padStart(precision, "0")}`;
}

// -- Exports -------------------------------------------------------------------

export { formatTime };
