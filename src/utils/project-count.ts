import { pluralize } from "insync/pluralize";

// -- Formatting ---------------------------------------------------------------

function formatProjectCount(count: number): string {
  return pluralize(count, "project");
}

// -- Exports ------------------------------------------------------------------

export { formatProjectCount };
