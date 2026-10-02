import { lastOpenedAt } from "@/domain/project/opened-at";
import { describe, expect, it } from "vitest";

describe("lastOpenedAt", () => {
  it("is when the project was last opened", () => {
    expect(lastOpenedAt({ openedAt: 50, updatedAt: 90 })).toBe(50);
  });

  describe("edge cases", () => {
    it("falls back to the last edit for entries saved before openedAt existed", () => {
      expect(lastOpenedAt({ updatedAt: 90 })).toBe(90);
    });

    it("keeps an openedAt of zero instead of falling back", () => {
      expect(lastOpenedAt({ openedAt: 0, updatedAt: 90 })).toBe(0);
    });
  });
});
