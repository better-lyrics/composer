import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import { lineText } from "@/domain/line/text";
import { lineTimingWordId } from "@/domain/word/id";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import { useSettingsStore } from "@/stores/settings";
import { getSplitCharacter } from "@/utils/split-character";
import { convertLineToWord, createTrackWordsFromTextAt } from "@/utils/sync-helpers";

describe("createTrackWordsFromTextAt", () => {
  const base: LyricLine = { id: "l", agentId: "v1", text: "main", backgroundText: "ooh yeah" };

  it("times untimed bg text from the given start", () => {
    const words = createTrackWordsFromTextAt(base, "bg", 5, 100);
    expect(words?.map((w) => w.text + w.sep)).toEqual(["ooh ", "yeah"]);
    expect(words?.[0].begin).toBe(5);
  });

  describe("edge cases", () => {
    it("returns null when the bg track already has words", () => {
      const timed: LyricLine = {
        ...base,
        backgroundWords: [{ id: "w1", text: "ooh yeah", sep: "", begin: 1, end: 2, joinsNext: false }],
      };
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
      expect(words.map((w) => w.text + w.sep).join("")).toBe("la la la");
    });
  });

  describe("main track", () => {
    const split = getSplitCharacter();
    const untimed: LyricLine = { id: "m", agentId: "v1", text: `hel${split}lo world` };

    it("lays out one block per syllable from the given start", () => {
      const words = createTrackWordsFromTextAt(untimed, "word", 5, 100) ?? [];
      expect(words.map((w) => w.text + w.sep)).toEqual(["hel", "lo ", "world"]);
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
        const timed: LyricLine = {
          ...untimed,
          words: [{ id: "w2", text: "hello world", sep: "", begin: 1, end: 2, joinsNext: false }],
        };
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
        expect(reconstructLineText(words, split)).toBe(lineText(untimed));
      });
    });
  });
});

describe("convertLineToWord", () => {
  it("keeps the line-synced word id on the first word", () => {
    const line: Parameters<typeof convertLineToWord>[0] = { id: "line-1", text: "Into the quiet", begin: 1, end: 4 };
    const converted = convertLineToWord(line);
    expect(converted.words?.[0].id).toBe(lineTimingWordId("line-1"));
    expect(new Set(converted.words?.map((word) => word.id)).size).toBe(3);
  });
});
