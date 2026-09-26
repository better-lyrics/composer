import type { LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";

// -- Types --------------------------------------------------------------------

type TimingGranularity = "line" | "word";

// -- Derivation ---------------------------------------------------------------

function timingGranularityOf(lines: readonly LyricLine[]): TimingGranularity {
  return lines.some(isWordSynced) ? "word" : "line";
}

// -- Exports ------------------------------------------------------------------

export { timingGranularityOf };
