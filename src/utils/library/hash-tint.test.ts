import { describe, expect, it } from "vitest";
import { hashTint, TINTS } from "@/utils/library/hash-tint";

describe("hashTint", () => {
  it("returns the same tint for the same seed across calls", () => {
    const first = hashTint("project-id-42");
    const second = hashTint("project-id-42");
    const third = hashTint("project-id-42");
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it("returns one of the four pastel tints", () => {
    const tint = hashTint("anything");
    expect(TINTS).toContain(tint);
  });

  describe("distribution", () => {
    it("uses every tint across 100 distinct seeds", () => {
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) {
        seen.add(hashTint(`seed-${i}`));
      }
      for (const tint of TINTS) {
        expect(seen.has(tint)).toBe(true);
      }
    });
  });

  describe("edge cases", () => {
    it("handles the empty seed deterministically", () => {
      expect(hashTint("")).toBe(hashTint(""));
      expect(TINTS).toContain(hashTint(""));
    });

    it("handles unicode seeds", () => {
      const t1 = hashTint("こんにちは");
      const t2 = hashTint("こんにちは");
      expect(t1).toBe(t2);
      expect(TINTS).toContain(t1);
    });

    it("handles very long seeds", () => {
      const long = "x".repeat(10_000);
      expect(TINTS).toContain(hashTint(long));
    });
  });
});
