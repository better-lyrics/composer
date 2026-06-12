import { describe, expect, it } from "vitest";
import { applyMainWordEdit } from "@/domain/line/main-words";
import type { LyricLine } from "@/domain/line/model";
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
      expect(result.words).toEqual(words);
    });
    it("re-derives text from the new words", () => {
      const words: WordTiming[] = [
        { text: "world ", begin: 0, end: 0.5 },
        { text: "hello", begin: 0.5, end: 1 },
      ];
      const result = applyMainWordEdit(baseLine(), words);
      expect(result.text).toBe("world hello");
    });
  });

  describe("edge cases", () => {
    it("clears words and begin/end when given an empty array (reconcileLine semantics)", () => {
      const line = baseLine();
      const result = applyMainWordEdit(line, []);
      expect(result.words).toEqual([]);
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
      expect(result.text).toBe(reconstructLineText(words, getSplitCharacter()));
    });
  });
});
