import type { TimingGranularity } from "@/domain/project/timing-granularity";

// -- Constants ----------------------------------------------------------------

const DEFAULT_EXPORT_TIMING: TimingGranularity = "word";

// -- Functions ----------------------------------------------------------------

function savedExportTiming(value: unknown): TimingGranularity {
  return value === "line" || value === "word" ? value : DEFAULT_EXPORT_TIMING;
}

// -- Exports ------------------------------------------------------------------

export { DEFAULT_EXPORT_TIMING, savedExportTiming };
