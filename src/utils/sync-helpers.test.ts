import type { LyricLine } from "@/domain/line/model";
import { createBgWordsFromTextAt } from "@/utils/sync-helpers";
import { describe, expect, it } from "vitest";

describe("createBgWordsFromTextAt", () => {
  const base: LyricLine = { id: "l", agentId: "v1", text: "main", backgroundText: "ooh yeah" };

  it("times untimed bg text from the given start", () => {
    const words = createBgWordsFromTextAt(base, 5, 100);
    expect(words?.map((w) => w.text)).toEqual(["ooh ", "yeah"]);
    expect(words?.[0].begin).toBe(5);
  });

  describe("edge cases", () => {
    it("returns null when the bg track already has words", () => {
      const timed: LyricLine = { ...base, backgroundWords: [{ text: "ooh yeah", begin: 1, end: 2 }] };
      expect(createBgWordsFromTextAt(timed, 5, 100)).toBeNull();
    });

    it("returns null when there is no bg text", () => {
      expect(createBgWordsFromTextAt({ ...base, backgroundText: undefined }, 5, 100)).toBeNull();
    });

    it("returns null for whitespace-only bg text", () => {
      expect(createBgWordsFromTextAt({ ...base, backgroundText: "   " }, 5, 100)).toBeNull();
    });

    it("never runs past the max end", () => {
      const words = createBgWordsFromTextAt(base, 9.9, 10);
      expect(words?.[words.length - 1].end).toBeLessThanOrEqual(10);
    });
  });

  describe("invariants", () => {
    it("keeps the bg text unchanged word for word", () => {
      const words = createBgWordsFromTextAt({ ...base, backgroundText: "la la la" }, 0, 100) ?? [];
      expect(words.map((w) => w.text).join("")).toBe("la la la");
    });
  });
});
