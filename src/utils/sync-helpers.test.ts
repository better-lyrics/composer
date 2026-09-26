import type { LyricLine } from "@/domain/line/model";
import { createLine } from "@/test/factories";
import { createBgWordsFromTextAt, withSeededBackgroundWords } from "@/utils/sync-helpers";
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

describe("withSeededBackgroundWords", () => {
  it("seeds background words for a timed line with background text and no words", () => {
    const line = createLine({ text: "a", begin: 10, end: 12, backgroundText: "oh" });
    expect(withSeededBackgroundWords(line).backgroundWords?.length).toBe(1);
  });
  it("invariant: returns the same reference when there is nothing to seed", () => {
    const untimed = createLine({ text: "a", backgroundText: "oh" });
    const seeded = createLine({
      text: "a",
      begin: 1,
      end: 2,
      backgroundText: "oh",
      backgroundWords: [{ text: "oh", begin: 1, end: 2 }],
    });
    const plain = createLine({ text: "a", begin: 1, end: 2 });
    expect(withSeededBackgroundWords(untimed)).toBe(untimed);
    expect(withSeededBackgroundWords(seeded)).toBe(seeded);
    expect(withSeededBackgroundWords(plain)).toBe(plain);
  });
});
