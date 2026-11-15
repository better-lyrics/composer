import type { LyricLine } from "insync/line";
import { isWordSynced } from "insync/line-predicates";

// -- Types --------------------------------------------------------------------

type TimingGranularity = "line" | "word";

// -- Derivation ---------------------------------------------------------------

function timingGranularityOf(lines: readonly LyricLine[]): TimingGranularity {
  return lines.some(isWordSynced) ? "word" : "line";
}

// -- Exports ------------------------------------------------------------------

export { timingGranularityOf };
export type { TimingGranularity };
