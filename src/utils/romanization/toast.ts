import type { GenerateForProjectResult } from "@/utils/romanization/generate-for-project";
import { RateLimitError } from "@/utils/romanization/google/fetch";
import { toast } from "sonner";

// -- Messages -----------------------------------------------------------------

const RATE_LIMIT_BULK = "Google rate limit hit. Some lines were skipped, try again in a minute.";
const RATE_LIMIT_SINGLE = "Google rate limit hit, try again in a minute.";
const BULK_NONE = "Could not generate romanization for any line.";
const LINE_FAILED = "Could not regenerate this line.";
const WORD_FAILED = "Could not regenerate this word.";

// -- Helpers ------------------------------------------------------------------

type SingleContext = "line" | "word";

function toastRomanizationError(context: SingleContext, error: unknown): void {
  if (error instanceof RateLimitError) {
    toast.error(RATE_LIMIT_SINGLE);
    return;
  }
  toast.error(context === "word" ? WORD_FAILED : LINE_FAILED);
}

function toastBulkRomanizationResult(result: GenerateForProjectResult): void {
  if (result.aborted) return;
  if (result.rateLimited) {
    toast.error(RATE_LIMIT_BULK);
    return;
  }
  if (result.errors.length === 0 && result.done > 0) {
    toast.success(`Generated romanization for ${result.done} ${result.done === 1 ? "line" : "lines"}.`);
    return;
  }
  if (result.errors.length > 0 && result.done > 0) {
    toast.warning(`Generated ${result.done} of ${result.total} lines. ${result.errors.length} failed.`);
    return;
  }
  if (result.errors.length > 0 && result.done === 0) {
    toast.error(BULK_NONE);
  }
}

// -- Exports ------------------------------------------------------------------

export { toastBulkRomanizationResult, toastRomanizationError };
