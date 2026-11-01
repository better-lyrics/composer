import { describe, expect, it } from "vitest";
import { escapeRegex } from "@/utils/escape-regex";

describe("escapeRegex", () => {
  it("matches the input literally once compiled", () => {
    expect(new RegExp(escapeRegex("(magnet)")).test("Snap (magnet)")).toBe(true);
    expect(new RegExp(escapeRegex("a.b")).test("axb")).toBe(false);
  });

  describe("edge cases", () => {
    it("returns an empty string unchanged", () => {
      expect(escapeRegex("")).toBe("");
    });

    it("escapes every regex metacharacter", () => {
      const metacharacters = ".*+?^${}()|[]\\";
      expect(new RegExp(`^${escapeRegex(metacharacters)}$`).test(metacharacters)).toBe(true);
    });

    it("leaves unicode and plain text alone", () => {
      expect(escapeRegex("café |")).toBe("café \\|");
    });
  });
});
