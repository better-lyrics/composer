// -- Constants ----------------------------------------------------------------

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

// -- Public -------------------------------------------------------------------

function relativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  const diff = nowMs - timestampMs;
  if (diff < MINUTE_MS) return "just now";
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`;
  if (diff < WEEK_MS) return `${Math.floor(diff / DAY_MS)}d ago`;
  if (diff < MONTH_MS) return `${Math.floor(diff / WEEK_MS)}w ago`;
  if (diff < YEAR_MS) return `${Math.floor(diff / MONTH_MS)}mo ago`;
  return `${Math.floor(diff / YEAR_MS)}y ago`;
}

// -- Exports ------------------------------------------------------------------

export { relativeTime };
