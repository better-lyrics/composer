import { describe, expect, it } from "vitest";
import { applyMainWordEdit, mainWordEditFields } from "@/domain/line/main-words";
import type { LyricLine } from "@/domain/line/model";
import { lineText, mainWords } from "@/domain/line/voices";
import type { WordTiming } from "@/domain/word/timing";

const baseLine = (overrides: Partial<LyricLine> = {}): LyricLine =>
  ({
    id: "l1",
    agentId: "a1",
    text: "hello world",
    words: [
      { text: "hello ", begin: 0, end: 0.5 },
      { text: "world", begin: 0.5, end: 1 },
    ],
    ...overrides,
  }) as LyricLine;

describe("applyMainWordEdit", () => {
  describe("happy paths", () => {
    it("sets the new words", () => {
      const words: WordTiming[] = [{ text: "hey", begin: 0, end: 0.5 }];
      const result = applyMainWordEdit(baseLine(), words);
      expect(mainWords(result)).toEqual(words);
    });
    it("re-derives text from the new words", () => {
      const words: WordTiming[] = [
        { text: "world ", begin: 0, end: 0.5 },
        { text: "hello", begin: 0.5, end: 1 },
      ];
      const result = applyMainWordEdit(baseLine(), words);
      expect(lineText(result)).toBe("world hello");
    });
  });

  describe("edge cases", () => {
    it("clears words and begin/end when given an empty array (reconcileLine semantics)", () => {
      const line = baseLine();
      const result = applyMainWordEdit(line, []);
      expect(mainWords(result)).toEqual([]);
    });
    it("preserves agentId, groupId, instanceIdx, and other non-timing fields", () => {
      const line = baseLine({ groupId: "g1", instanceIdx: 2, templateLineIdx: 0 });
      const result = applyMainWordEdit(line, [{ text: "x", begin: 0, end: 1 }]);
      expect(result.agentId).toBe("a1");
      expect((result as LyricLine & { groupId?: string }).groupId).toBe("g1");
    });
  });

  describe("invariants", () => {
    it("does not mutate the input line", () => {
      const line = baseLine();
      const before = JSON.stringify(line);
      applyMainWordEdit(line, [{ text: "z", begin: 0, end: 1 }]);
      expect(JSON.stringify(line)).toBe(before);
    });
    it("text matches what reconstructLineText would produce for the new words", async () => {
      const { reconstructLineText } = await import("@/domain/line/reconstruct-text");
      const { getSplitCharacter } = await import("@/utils/split-character");
      const words: WordTiming[] = [
        { text: "a ", begin: 0, end: 0.5 },
        { text: "b", begin: 0.5, end: 1 },
      ];
      const result = applyMainWordEdit(baseLine(), words);
      expect(lineText(result)).toBe(reconstructLineText(words, getSplitCharacter()));
    });
  });
});

describe("mainWordEditFields", () => {
  describe("happy paths", () => {
    it("returns a { words, text } pair", () => {
      const words: WordTiming[] = [
        { text: "hi ", begin: 0, end: 0.5 },
        { text: "there", begin: 0.5, end: 1 },
      ];
      const fields = mainWordEditFields(words);
      expect(fields.words).toEqual(words);
      expect(typeof fields.text).toBe("string");
    });

    it("derives text via reconstructLineText", async () => {
      const { reconstructLineText } = await import("@/domain/line/reconstruct-text");
      const { getSplitCharacter } = await import("@/utils/split-character");
      const words: WordTiming[] = [
        { text: "foo ", begin: 0, end: 0.5 },
        { text: "bar", begin: 0.5, end: 1 },
      ];
      expect(mainWordEditFields(words).text).toBe(reconstructLineText(words, getSplitCharacter()));
    });
  });

  describe("invariants", () => {
    it("produces the same text as applyMainWordEdit when spread into a line", () => {
      const words: WordTiming[] = [
        { text: "ping ", begin: 0, end: 0.5 },
        { text: "pong", begin: 0.5, end: 1 },
      ];
      const direct = applyMainWordEdit(baseLine(), words);
      const fields = mainWordEditFields(words);
      expect(lineText(direct)).toBe(fields.text);
      expect(mainWords(direct)).toEqual(fields.words);
    });

    it("does not mutate the input words array", () => {
      const words: WordTiming[] = [{ text: "z", begin: 0, end: 1 }];
      const before = JSON.stringify(words);
      mainWordEditFields(words);
      expect(JSON.stringify(words)).toBe(before);
    });
  });
});
