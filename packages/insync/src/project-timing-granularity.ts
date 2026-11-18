import type { LyricLine } from "./line";
import { isWordSynced } from "./line-predicates";

// -- Types --------------------------------------------------------------------

type TimingGranularity = "line" | "word";

// -- Derivation ---------------------------------------------------------------

function timingGranularityOf(lines: readonly LyricLine[]): TimingGranularity {
  return lines.some(isWordSynced) ? "word" : "line";
}

// -- Exports ------------------------------------------------------------------

export { timingGranularityOf };
export type { TimingGranularity };
