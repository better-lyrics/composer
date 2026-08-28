import { describe, expect, it } from "vitest";
import { isClientError } from "@/utils/lyrics-search/http-status";

describe("isClientError", () => {
  it("is true across the whole 4xx range", () => {
    expect(isClientError(400)).toBe(true);
    expect(isClientError(401)).toBe(true);
    expect(isClientError(429)).toBe(true);
    expect(isClientError(499)).toBe(true);
  });

  it("is false below 400 and at/above 500", () => {
    expect(isClientError(399)).toBe(false);
    expect(isClientError(200)).toBe(false);
    expect(isClientError(304)).toBe(false);
    expect(isClientError(500)).toBe(false);
    expect(isClientError(503)).toBe(false);
  });
});
