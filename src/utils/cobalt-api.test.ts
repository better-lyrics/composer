import { describe, expect, it } from "vitest";
import { CobaltApiError, mapError } from "@/utils/cobalt-api";

describe("mapError - known codes", () => {
  it("maps turnstile_failed to a user-readable message", () => {
    expect(mapError("turnstile_failed")).toBe("Verification failed, refresh and try again");
  });

  it("maps rate_limited to a user-readable message", () => {
    expect(mapError("rate_limited")).toBe("Too many requests, wait a minute and try again");
  });

  it("maps geo_blocked to a regional message", () => {
    expect(mapError("geo_blocked")).toBe("This video isn't available in this region");
  });

  it("maps invalid_video_id to a validation message", () => {
    expect(mapError("invalid_video_id")).toBe("That doesn't look like a valid YouTube video");
  });

  it("maps jwt_expired to a session message", () => {
    expect(mapError("jwt_expired")).toBe("Session expired, refresh and try again");
  });
});

describe("mapError - unknown codes", () => {
  it("falls back to the generic unknown message", () => {
    expect(mapError("totally_made_up_code")).toBe("Something went wrong, try again");
  });

  it("falls back for empty string", () => {
    expect(mapError("")).toBe("Something went wrong, try again");
  });
});

describe("CobaltApiError", () => {
  it("constructs with code, status, and a mapped message", () => {
    const err = new CobaltApiError("rate_limited", 429);
    expect(err.code).toBe("rate_limited");
    expect(err.status).toBe(429);
    expect(err.message).toBe("Too many requests, wait a minute and try again");
    expect(err.name).toBe("CobaltApiError");
  });

  it("constructs with unknown code and falls back gracefully", () => {
    const err = new CobaltApiError("strange_code", 500);
    expect(err.code).toBe("strange_code");
    expect(err.status).toBe(500);
    expect(err.message).toBe("Something went wrong, try again");
  });

  it("is throwable and catchable as Error", () => {
    expect(() => {
      throw new CobaltApiError("turnstile_failed", 403);
    }).toThrow(CobaltApiError);

    try {
      throw new CobaltApiError("turnstile_failed", 403);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(CobaltApiError);
    }
  });
});
