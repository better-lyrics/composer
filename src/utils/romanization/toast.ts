import { toast } from "sonner";
import { RateLimitError, RomanizationApiError, ServiceUnavailableError, TurnstileError } from "@/lib/romanization-api";

// -- Types --------------------------------------------------------------------

interface BulkSummary {
  successCount: number;
  failureCount: number;
}

// -- Functions ----------------------------------------------------------------

function pluralLine(count: number): string {
  return count === 1 ? "line" : "lines";
}

function describeError(err: unknown): string | null {
  if (err instanceof DOMException && err.name === "AbortError") return null;
  if (err instanceof TurnstileError) return "Verification failed. Refresh the page and try again.";
  if (err instanceof RateLimitError) return `Rate limit hit. Try again in ${err.retryAfter}s.`;
  if (err instanceof ServiceUnavailableError) {
    return "Could not reach romanization service. Try again in a moment.";
  }
  if (err instanceof RomanizationApiError) return `Romanization request failed (${err.status}).`;
  return "Something went wrong while romanizing.";
}

function toastError(err: unknown): void {
  const message = describeError(err);
  if (message !== null) toast.error(message);
}

function toastBulkResult({ successCount, failureCount }: BulkSummary): void {
  if (successCount === 0 && failureCount === 0) return;
  if (failureCount === 0) {
    toast.success(`Romanized ${successCount} ${pluralLine(successCount)}.`);
    return;
  }
  if (successCount === 0) {
    toast.error(`Could not romanize ${failureCount} ${pluralLine(failureCount)}.`);
    return;
  }
  toast.warning(`Romanized ${successCount} ${pluralLine(successCount)}, ${failureCount} failed.`);
}

function toastPerLineFailure(err: unknown): void {
  toastError(err);
}

function toastPerWordFailure(err: unknown): void {
  toastError(err);
}

// -- Exports ------------------------------------------------------------------

export { toastBulkResult, toastError, toastPerLineFailure, toastPerWordFailure };
