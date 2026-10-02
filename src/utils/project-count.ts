import { pluralize } from "@/utils/pluralize";

// -- Formatting ---------------------------------------------------------------

function formatProjectCount(count: number): string {
  return pluralize(count, "project");
}

// -- Exports ------------------------------------------------------------------

export { formatProjectCount };
