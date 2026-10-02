import { pluralize } from "@/utils/pluralize";

// -- Formatting ---------------------------------------------------------------

function formatSavedAt(savedAt: number | undefined): string {
  if (!savedAt) return "unknown";
  try {
    return new Date(savedAt).toLocaleString();
  } catch {
    return new Date(savedAt).toISOString();
  }
}

function formatSavedWorkSummary(lineCount: number, savedAt: number | undefined): string {
  return `${pluralize(lineCount, "line")}, last edited ${formatSavedAt(savedAt)}`;
}

// -- Exports ------------------------------------------------------------------

export { formatSavedAt, formatSavedWorkSummary };
