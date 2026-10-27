import type { LyricLine } from "@/domain/line/model";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { getSplitCharacter } from "@/utils/split-character";
import { createTrackWordsFromTextAt, withSeededBackgroundWords } from "@/utils/sync-helpers";
import { describe, expect, it } from "vitest";

describe("createTrackWordsFromTextAt", () => {
  const base: LyricLine = { id: "l", agentId: "v1", text: "main", backgroundText: "ooh yeah" };

  it("times untimed bg text from the given start", () => {
    const words = createTrackWordsFromTextAt(base, "bg", 5, 100);
    expect(words?.map((w) => w.text)).toEqual(["ooh ", "yeah"]);
    expect(words?.[0].begin).toBe(5);
  });

  describe("edge cases", () => {
    it("returns null when the bg track already has words", () => {
      const timed: LyricLine = { ...base, backgroundWords: [{ text: "ooh yeah", begin: 1, end: 2 }] };
      expect(createTrackWordsFromTextAt(timed, "bg", 5, 100)).toBeNull();
    });

    it("returns null when there is no bg text", () => {
      expect(createTrackWordsFromTextAt({ ...base, backgroundText: undefined }, "bg", 5, 100)).toBeNull();
    });

    it("returns null for whitespace-only bg text", () => {
      expect(createTrackWordsFromTextAt({ ...base, backgroundText: "   " }, "bg", 5, 100)).toBeNull();
    });

    it("never runs past the max end", () => {
      const words = createTrackWordsFromTextAt(base, "bg", 9.9, 10);
      expect(words?.[words.length - 1].end).toBeLessThanOrEqual(10);
    });
  });

  describe("invariants", () => {
    it("keeps the bg text unchanged word for word", () => {
      const words = createTrackWordsFromTextAt({ ...base, backgroundText: "la la la" }, "bg", 0, 100) ?? [];
      expect(words.map((w) => w.text).join("")).toBe("la la la");
    });
  });

  describe("main track", () => {
    const split = getSplitCharacter();
    const untimed: LyricLine = { id: "m", agentId: "v1", text: `hel${split}lo world` };

    it("lays out one block per syllable from the given start", () => {
      const words = createTrackWordsFromTextAt(untimed, "word", 5, 100) ?? [];
      expect(words.map((w) => w.text)).toEqual(["hel", "lo ", "world"]);
      expect(words[0].begin).toBe(5);
    });

    it("keeps syllables grouped inside their word", () => {
      const words = createTrackWordsFromTextAt(untimed, "word", 0, 100) ?? [];
      expect(computeSyllableGroups(words).map((g) => [g.startIndex, g.endIndex])).toEqual([[0, 1]]);
    });

    it("gives each part the default word duration", () => {
      const { defaultWordDuration } = useSettingsStore.getState();
      const words = createTrackWordsFromTextAt(untimed, "word", 0, 100) ?? [];
      expect(words[words.length - 1].end).toBeCloseTo(3 * defaultWordDuration);
    });

    describe("edge cases", () => {
      it("returns null when the line already has words", () => {
        const timed: LyricLine = { ...untimed, words: [{ text: "hello world", begin: 1, end: 2 }] };
        expect(createTrackWordsFromTextAt(timed, "word", 5, 100)).toBeNull();
      });

      it("returns null for an empty line", () => {
        expect(createTrackWordsFromTextAt({ ...untimed, text: "" }, "word", 5, 100)).toBeNull();
      });

      it("never runs past the max end", () => {
        const words = createTrackWordsFromTextAt(untimed, "word", 9.9, 10) ?? [];
        expect(words[words.length - 1].end).toBeLessThanOrEqual(10);
      });
    });

    describe("invariants", () => {
      it("rebuilds the exact line text, split characters included", () => {
        const words = createTrackWordsFromTextAt(untimed, "word", 0, 100) ?? [];
        expect(reconstructLineText(words, split)).toBe(untimed.text);
      });
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
