import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { RateLimitError } from "@/utils/romanization/google/fetch";
import { toastBulkRomanizationResult, toastRomanizationError } from "@/utils/romanization/toast";
import type { GenerateForProjectResult } from "@/utils/romanization/generate-for-project";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("toastRomanizationError", () => {
  it("shows the rate-limit message when given a RateLimitError", () => {
    toastRomanizationError("line", new RateLimitError());
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/rate limit/i));
  });

  it("shows the rate-limit message regardless of context", () => {
    toastRomanizationError("word", new RateLimitError());
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/rate limit/i));
  });

  it("shows the word-specific message on a generic error in word context", () => {
    toastRomanizationError("word", new Error("anything"));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/word/i));
  });

  it("shows the line-specific message on a generic error in line context", () => {
    toastRomanizationError("line", new Error("anything"));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/line/i));
  });

  it("handles non-Error rejections without crashing", () => {
    expect(() => toastRomanizationError("line", "string error")).not.toThrow();
    expect(toast.error).toHaveBeenCalledOnce();
  });
});

const baseResult = (overrides: Partial<GenerateForProjectResult> = {}): GenerateForProjectResult => ({
  done: 0,
  total: 0,
  errors: [],
  aborted: false,
  rateLimited: false,
  ...overrides,
});

describe("toastBulkRomanizationResult: success paths", () => {
  it("shows a success message when every line succeeded (plural)", () => {
    toastBulkRomanizationResult(baseResult({ done: 3, total: 3 }));
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/3 lines/));
  });

  it("uses singular wording when exactly one line succeeded", () => {
    toastBulkRomanizationResult(baseResult({ done: 1, total: 1 }));
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/1 line[^s]/));
  });
});

describe("toastBulkRomanizationResult: partial paths", () => {
  it("shows a warning when some lines succeeded and some failed", () => {
    toastBulkRomanizationResult(
      baseResult({
        done: 2,
        total: 5,
        errors: [
          { lineId: "L3", message: "x" },
          { lineId: "L4", message: "y" },
          { lineId: "L5", message: "z" },
        ],
      }),
    );
    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/2 of 5/));
    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/3 failed/));
  });
});

describe("toastBulkRomanizationResult: error paths", () => {
  it("shows an error when every line failed", () => {
    toastBulkRomanizationResult(
      baseResult({
        done: 0,
        total: 2,
        errors: [
          { lineId: "L1", message: "x" },
          { lineId: "L2", message: "y" },
        ],
      }),
    );
    expect(toast.error).toHaveBeenCalledOnce();
  });

  it("shows the rate-limit message when rateLimited is true", () => {
    toastBulkRomanizationResult(
      baseResult({
        done: 0,
        total: 3,
        rateLimited: true,
        errors: [{ lineId: "L1", message: "x" }],
      }),
    );
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/rate limit/i));
  });

  it("the rate-limit branch takes precedence over the partial-success branch", () => {
    toastBulkRomanizationResult(
      baseResult({
        done: 2,
        total: 5,
        rateLimited: true,
        errors: [{ lineId: "L3", message: "x" }],
      }),
    );
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/rate limit/i));
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("toastBulkRomanizationResult: silent paths", () => {
  it("shows nothing when aborted", () => {
    toastBulkRomanizationResult(baseResult({ aborted: true, done: 1, total: 3 }));
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows nothing when the project had no eligible lines (done=0, total=0, no errors)", () => {
    toastBulkRomanizationResult(baseResult());
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
