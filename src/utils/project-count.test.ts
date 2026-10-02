import { formatProjectCount } from "@/utils/project-count";
import { describe, expect, it } from "vitest";

describe("formatProjectCount", () => {
  it("counts projects in words", () => {
    expect(formatProjectCount(1)).toBe("1 project");
    expect(formatProjectCount(3)).toBe("3 projects");
  });

  describe("edge cases", () => {
    it("uses the plural for zero", () => {
      expect(formatProjectCount(0)).toBe("0 projects");
    });
  });
});
