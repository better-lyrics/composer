import { describe, expect, it } from "vitest";
import { isAbortError } from "@/utils/abort-error";

// -- Helpers ------------------------------------------------------------------

function namedError(name: string, message = "boom"): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

async function rejectionOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
    return null;
  } catch (error) {
    return error;
  }
}

// -- Tests --------------------------------------------------------------------

describe("isAbortError", () => {
  it("recognises the DOMException a cancelled fetch rejects with", () => {
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
  });

  it("recognises a plain Error named AbortError", () => {
    expect(isAbortError(namedError("AbortError"))).toBe(true);
  });

  it("recognises an Error subclass named AbortError", () => {
    class CustomAbort extends Error {
      constructor() {
        super("aborted");
        this.name = "AbortError";
      }
    }
    expect(isAbortError(new CustomAbort())).toBe(true);
  });

  it("recognises what a real aborted fetch actually rejects with", async () => {
    const controller = new AbortController();
    controller.abort();
    const rejection = await rejectionOf(() => fetch("data:text/plain,ok", { signal: controller.signal }));
    expect(isAbortError(rejection)).toBe(true);
  });

  it("recognises what a real aborted signal rejects a pending promise with", async () => {
    const controller = new AbortController();
    const pending = rejectionOf(
      () =>
        new Promise((_resolve, reject) => {
          controller.signal.addEventListener("abort", () => reject(controller.signal.reason));
        }),
    );
    controller.abort();
    expect(isAbortError(await pending)).toBe(true);
  });

  describe("rejections it must not swallow", () => {
    it("rejects a DOMException with another name", () => {
      expect(isAbortError(new DOMException("boom", "NotFoundError"))).toBe(false);
      expect(isAbortError(new DOMException("boom", "TimeoutError"))).toBe(false);
    });

    it("rejects an unnamed DOMException", () => {
      expect(isAbortError(new DOMException("boom"))).toBe(false);
    });

    it("rejects ordinary errors", () => {
      expect(isAbortError(new Error("boom"))).toBe(false);
      expect(isAbortError(new TypeError("Failed to fetch"))).toBe(false);
    });

    it("regression: matches on the error name, never on its message", () => {
      expect(isAbortError(new Error("AbortError"))).toBe(false);
      expect(isAbortError(namedError("Error", "AbortError"))).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("rejects non-errors", () => {
      expect(isAbortError(null)).toBe(false);
      expect(isAbortError(undefined)).toBe(false);
      expect(isAbortError("AbortError")).toBe(false);
      expect(isAbortError(0)).toBe(false);
      expect(isAbortError(true)).toBe(false);
    });

    it("rejects a plain object that merely looks like an abort", () => {
      expect(isAbortError({ name: "AbortError", message: "aborted" })).toBe(false);
    });

    it("is case sensitive on the name", () => {
      expect(isAbortError(namedError("aborterror"))).toBe(false);
      expect(isAbortError(namedError("ABORTERROR"))).toBe(false);
    });

    it("rejects a name that only contains AbortError", () => {
      expect(isAbortError(namedError("NotAbortError"))).toBe(false);
      expect(isAbortError(namedError("AbortErrors"))).toBe(false);
    });
  });

  describe("invariants", () => {
    it("never throws, whatever it is handed", () => {
      const hostile = {
        get name(): string {
          throw new Error("trap");
        },
      };
      expect(() => isAbortError(hostile)).not.toThrow();
      expect(isAbortError(hostile)).toBe(false);
    });

    it("returns the same answer for the same error every time", () => {
      const error = namedError("AbortError");
      expect(isAbortError(error)).toBe(isAbortError(error));
    });

    it("does not mutate the error it inspects", () => {
      const error = namedError("AbortError", "aborted");
      isAbortError(error);
      expect(error.name).toBe("AbortError");
      expect(error.message).toBe("aborted");
    });
  });
});
