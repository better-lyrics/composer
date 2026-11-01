import { describeError } from "@/pages/error-presentation";
import { IconBug, IconDiscOff } from "@tabler/icons-react";
import { describe, expect, it } from "vitest";

function routeErrorResponse(status: number, statusText: string) {
  return { status, statusText, internal: false, data: "missing" };
}

describe("describeError", () => {
  it("presents a missing page as Page not found, pointing home", () => {
    const presentation = describeError(routeErrorResponse(404, "Not Found"));
    expect(presentation.title).toBe("Page not found");
    expect(presentation.subtitle).toBe("We couldn't find that page.");
    expect(presentation.status).toBe(404);
    expect(presentation.icon).toBe(IconDiscOff);
    expect(presentation.primaryAction).toBe("home");
  });

  it("presents no error at all as a missing page", () => {
    const presentation = describeError(undefined);
    expect(presentation.title).toBe("Page not found");
    expect(presentation.primaryAction).toBe("home");
    expect(presentation.icon).toBe(IconDiscOff);
  });

  it("presents a thrown error with its message, offering Reload first", () => {
    const presentation = describeError(new TypeError("Boom"));
    expect(presentation.title).toBe("Something broke");
    expect(presentation.subtitle).toBe("Boom");
    expect(presentation.errorName).toBe("TypeError");
    expect(presentation.icon).toBe(IconBug);
    expect(presentation.primaryAction).toBe("reload");
  });

  it("keeps the status as the title for other route error responses", () => {
    const presentation = describeError(routeErrorResponse(500, "Server Error"));
    expect(presentation.title).toBe("500");
    expect(presentation.subtitle).toBe("Server Error");
    expect(presentation.primaryAction).toBe("reload");
  });

  describe("invariants", () => {
    it("picks the same icon every time for the same kind of error", () => {
      const icons = Array.from({ length: 10 }, () => describeError(new Error("x")).icon);
      expect(new Set(icons).size).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("presents a thrown string as its own subtitle", () => {
      const presentation = describeError("plain failure");
      expect(presentation.title).toBe("Something broke");
      expect(presentation.subtitle).toBe("plain failure");
      expect(presentation.primaryAction).toBe("reload");
    });
  });
});
