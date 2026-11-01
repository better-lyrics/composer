// -- Constants ----------------------------------------------------------------

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

// -- Formatting ---------------------------------------------------------------

function formatShortDate(timestamp: number, now: number): string {
  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
}

function formatRelativeTime(timestamp: number, now: number): string {
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < MINUTE_MS) return "Just now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} h ago`;
  if (elapsed < 2 * DAY_MS) return "Yesterday";
  if (elapsed < WEEK_MS) return `${Math.floor(elapsed / DAY_MS)} days ago`;
  return formatShortDate(timestamp, now);
}

function formatRelativeTimeInline(timestamp: number, now: number): string {
  const label = formatRelativeTime(timestamp, now);
  return now - timestamp < WEEK_MS ? label.toLowerCase() : label;
}

// -- Exports ------------------------------------------------------------------

export { formatRelativeTime, formatRelativeTimeInline, formatShortDate };
