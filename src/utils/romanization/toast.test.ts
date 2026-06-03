import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimitError, RomanizationApiError, ServiceUnavailableError, TurnstileError } from "@/lib/romanization-api";
import { toastBulkResult, toastError, toastPerLineFailure, toastPerWordFailure } from "@/utils/romanization/toast";

// TDD policy: sonner is a third-party UI library with visual side effects we cannot
// assert against in the unit project. We mock it to verify the dispatch + formatting
// logic; the toast emission itself is exercised through consuming view tests.

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

beforeEach(() => {
  for (const key of Object.keys(toastMock) as Array<keyof typeof toastMock>) toastMock[key].mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toastError", () => {
  it("formats TurnstileError as a refresh hint", () => {
    toastError(new TurnstileError());
    expect(toastMock.error).toHaveBeenCalledWith("Verification failed. Refresh the page and try again.");
  });

  it("formats RateLimitError with the retryAfter value", () => {
    toastError(new RateLimitError(17));
    expect(toastMock.error).toHaveBeenCalledWith("Rate limit hit. Try again in 17s.");
  });

  it("formats ServiceUnavailableError as a try-again-later hint", () => {
    toastError(new ServiceUnavailableError());
    expect(toastMock.error).toHaveBeenCalledWith("Could not reach romanization service. Try again in a moment.");
  });

  it("formats generic RomanizationApiError with status", () => {
    toastError(new RomanizationApiError("bad", "unknown", 400));
    expect(toastMock.error).toHaveBeenCalledWith("Romanization request failed (400).");
  });

  it("formats AbortError silently (no toast)", () => {
    toastError(new DOMException("aborted", "AbortError"));
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("formats unknown error generically", () => {
    toastError(new TypeError("boom"));
    expect(toastMock.error).toHaveBeenCalledWith("Something went wrong while romanizing.");
  });
});

describe("toastBulkResult", () => {
  it("shows success when all lines succeeded", () => {
    toastBulkResult({ successCount: 5, failureCount: 0 });
    expect(toastMock.success).toHaveBeenCalledWith("Romanized 5 lines.");
  });

  it("shows partial warning when some failed", () => {
    toastBulkResult({ successCount: 3, failureCount: 2 });
    expect(toastMock.warning).toHaveBeenCalledWith("Romanized 3 lines, 2 failed.");
  });

  it("shows error when all failed", () => {
    toastBulkResult({ successCount: 0, failureCount: 4 });
    expect(toastMock.error).toHaveBeenCalledWith("Could not romanize 4 lines.");
  });

  it("uses singular for a single line", () => {
    toastBulkResult({ successCount: 1, failureCount: 0 });
    expect(toastMock.success).toHaveBeenCalledWith("Romanized 1 line.");
  });

  it("is a no-op when both counts are zero", () => {
    toastBulkResult({ successCount: 0, failureCount: 0 });
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.warning).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});

describe("toastPerLineFailure", () => {
  it("shows a single-line failure with the API error message", () => {
    toastPerLineFailure(new ServiceUnavailableError());
    expect(toastMock.error).toHaveBeenCalledWith("Could not reach romanization service. Try again in a moment.");
  });
});

describe("toastPerWordFailure", () => {
  it("shows a per-word failure with the API error message", () => {
    toastPerWordFailure(new TurnstileError());
    expect(toastMock.error).toHaveBeenCalledWith("Verification failed. Refresh the page and try again.");
  });
});
