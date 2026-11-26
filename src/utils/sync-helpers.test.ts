import { describe, expect, it } from "vitest";
import { fieldsOfLine, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { convertLineToWord } from "@/domain/line/span-to-words";
import { lineText, syllablesText } from "@/domain/line/text";
import { roleWords } from "@/domain/line/track";
import { lineTimingWordId } from "@/domain/word/id";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { getSplitCharacter } from "@/utils/split-character";
import { createTrackWordsFromTextAt } from "@/utils/sync-helpers";

describe("createTrackWordsFromTextAt", () => {
  const base: LyricLine = lineFromFields({ id: "l", agentId: "v1", text: "main", backgroundText: "ooh yeah" });

  it("times untimed bg text from the given start", () => {
    const words = createTrackWordsFromTextAt(base, "bg", 5, 100);
    expect(words?.map((w) => w.text + w.sep)).toEqual(["ooh ", "yeah"]);
    expect(words?.[0].begin).toBe(5);
  });

  describe("edge cases", () => {
    it("returns null when the bg track already has words", () => {
      const timed: LyricLine = lineFromFields({
        ...fieldsOfLine(base),
        backgroundWords: [{ id: "w1", text: "ooh yeah", sep: "", begin: 1, end: 2, joinsNext: false }],
      });
      expect(createTrackWordsFromTextAt(timed, "bg", 5, 100)).toBeNull();
    });

    it("returns null when there is no bg text", () => {
      expect(
        createTrackWordsFromTextAt(lineFromFields({ ...fieldsOfLine(base), backgroundText: undefined }), "bg", 5, 100),
      ).toBeNull();
    });

    it("returns null for whitespace-only bg text", () => {
      expect(
        createTrackWordsFromTextAt(lineFromFields({ ...fieldsOfLine(base), backgroundText: "   " }), "bg", 5, 100),
      ).toBeNull();
    });

    it("never runs past the max end", () => {
      const words = createTrackWordsFromTextAt(base, "bg", 9.9, 10);
      expect(words?.[words.length - 1].end).toBeLessThanOrEqual(10);
    });
  });

  describe("invariants", () => {
    it("keeps the bg text unchanged word for word", () => {
      const words =
        createTrackWordsFromTextAt(
          lineFromFields({ ...fieldsOfLine(base), backgroundText: "la la la" }),
          "bg",
          0,
          100,
        ) ?? [];
      expect(words.map((w) => w.text + w.sep).join("")).toBe("la la la");
    });
  });

  describe("main track", () => {
    const split = getSplitCharacter();
    const untimed: LyricLine = lineFromFields({ id: "m", agentId: "v1", text: `hel${split}lo world` });

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
        const timed: LyricLine = lineFromFields({
          ...fieldsOfLine(untimed),
          words: [{ id: "w2", text: "hello world", sep: "", begin: 1, end: 2, joinsNext: false }],
        });
        expect(createTrackWordsFromTextAt(timed, "word", 5, 100)).toBeNull();
      });

      it("returns null for an empty line", () => {
        expect(
          createTrackWordsFromTextAt(lineFromFields({ ...fieldsOfLine(untimed), text: "" }), "word", 5, 100),
        ).toBeNull();
      });

      it("never runs past the max end", () => {
        const words = createTrackWordsFromTextAt(untimed, "word", 9.9, 10) ?? [];
        expect(words[words.length - 1].end).toBeLessThanOrEqual(10);
      });
    });

    describe("invariants", () => {
      it("rebuilds the exact line text, split characters included", () => {
        const words = createTrackWordsFromTextAt(untimed, "word", 0, 100) ?? [];
        expect(syllablesText(words, split)).toBe(lineText(untimed));
      });
    });
  });
});

describe("convertLineToWord", () => {
  it("keeps the line-synced word id on the first word", () => {
    const line = createLine({ id: "line-1", text: "Into the quiet", begin: 1, end: 4 });
    const converted = convertLineToWord(line);
    expect(roleWords(converted, "main")?.[0].id).toBe(lineTimingWordId("line-1"));
    expect(new Set(roleWords(converted, "main")?.map((word) => word.id)).size).toBe(3);
  });
});
