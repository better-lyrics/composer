/**
 * @vitest-environment node
 */
import type { TransliterationTrack } from "@/domain/language/model";
import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

// -- Fixtures -----------------------------------------------------------------

const track: TransliterationTrack = {
  language: "ko-Latn",
  text: "Uh  ildan eun  na",
  backgroundText: "geurae  yeah",
  segments: [{ original: "Uh 일단은 나", transliteration: "Uh  ildan eun  na" }],
  backgroundSegments: [{ original: "그래 yeah", transliteration: "geurae  yeah" }],
  origin: "google",
  sourceFingerprint: "source",
};

function splitKoreanLine(overrides: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({
    id: "line-1",
    agentId: "v1",
    text: "Uh 일|단은 나",
    words: [
      { text: "Uh ", begin: 0, end: 0.5 },
      { text: "일", begin: 0.5, end: 0.8, syllableGroupId: "g1" },
      { text: "단은 ", begin: 0.8, end: 1.5, syllableGroupId: "g1" },
      { text: "나", begin: 1.5, end: 2 },
    ],
    transliteration: track,
    ...overrides,
  });
}

function lineById(id: string): LyricLine | undefined {
  return useProjectStore.getState().lines.find((line) => line.id === id);
}

// -- Tests --------------------------------------------------------------------

describe("mergeSyllableGroupIntoWord · transliteration", () => {
  describe("regressions", () => {
    it("regression: merges the aligned pieces when stored words lost them (#283)", () => {
      useProjectStore.getState().setLines([splitKoreanLine()]);

      useProjectStore.getState().mergeSyllableGroupIntoWord("line-1", "words", [1]);

      const merged = lineById("line-1");
      expect(merged?.words?.map((word) => word.text)).toEqual(["Uh ", "일단은 ", "나"]);
      expect(merged?.words?.[1].transliteration).toBe("ildan eun");
      expect(merged?.transliteration).toEqual(track);
    });

    it("regression: keeps the last syllable's joiner on the merged word (#283)", () => {
      const line = splitKoreanLine({
        words: [
          { text: "Uh ", begin: 0, end: 0.5, transliteration: "Uh", transliterationJoinerAfter: "  " },
          {
            text: "일",
            begin: 0.5,
            end: 0.8,
            syllableGroupId: "g1",
            transliteration: "il",
            transliterationJoinerAfter: "",
          },
          {
            text: "단은 ",
            begin: 0.8,
            end: 1.5,
            syllableGroupId: "g1",
            transliteration: "dan eun",
            transliterationJoinerAfter: "  ",
          },
          { text: "나", begin: 1.5, end: 2, transliteration: "na" },
        ],
      });
      useProjectStore.getState().setLines([line]);

      useProjectStore.getState().mergeSyllableGroupIntoWord("line-1", "words", [2]);

      const mergedWord = lineById("line-1")?.words?.[1];
      expect(mergedWord?.transliteration).toBe("ildan eun");
      expect(mergedWord?.transliterationJoinerAfter).toBe("  ");
    });

    it("regression: merges a background group from its aligned pieces (#283)", () => {
      useProjectStore.getState().setLines([
        splitKoreanLine({
          backgroundText: "그|래 yeah",
          backgroundWords: [
            { text: "그", begin: 2, end: 2.2, syllableGroupId: "b1" },
            { text: "래 ", begin: 2.2, end: 2.5, syllableGroupId: "b1" },
            { text: "yeah", begin: 2.5, end: 3 },
          ],
        }),
      ]);

      useProjectStore.getState().mergeSyllableGroupIntoWord("line-1", "backgroundWords", [0]);

      const merged = lineById("line-1");
      expect(merged?.backgroundWords?.map((word) => word.text)).toEqual(["그래 ", "yeah"]);
      expect(merged?.backgroundWords?.map((word) => word.transliteration)).toEqual(["geurae", "yeah"]);
      expect(merged?.transliteration).toEqual(track);
    });
  });

  describe("cross-field interactions", () => {
    it("merges a linked sibling with its own aligned pieces", () => {
      useProjectStore.getState().addGroup({ id: "chorus", label: "Chorus", color: "#f472b6", templateVersion: 1 });
      const linked = { groupId: "chorus", templateLineIdx: 0 };
      useProjectStore.getState().setLines([
        splitKoreanLine({ id: "a0", instanceIdx: 0, ...linked }),
        splitKoreanLine({
          id: "a1",
          instanceIdx: 1,
          ...linked,
          words: [
            { text: "Uh ", begin: 10, end: 10.5 },
            { text: "일", begin: 10.5, end: 10.8, syllableGroupId: "g2" },
            { text: "단은 ", begin: 10.8, end: 11.5, syllableGroupId: "g2" },
            { text: "나", begin: 11.5, end: 12 },
          ],
          transliteration: { ...track, text: "Uh  ilttan eun  na" },
        }),
      ]);

      useProjectStore.getState().mergeSyllableGroupIntoWord("a0", "words", [1]);

      expect(lineById("a0")?.words?.[1].transliteration).toBe("ildan eun");
      expect(lineById("a1")?.words?.map((word) => word.text)).toEqual(["Uh ", "일단은 ", "나"]);
      expect(lineById("a1")?.words?.[1].transliteration).toBe("ilttan eun");
    });
  });

  describe("edge cases", () => {
    it("merges a line without a transliteration track as before", () => {
      const { transliteration: _track, ...line } = splitKoreanLine();
      useProjectStore.getState().setLines([line]);

      useProjectStore.getState().mergeSyllableGroupIntoWord("line-1", "words", [1]);

      expect(lineById("line-1")?.words).toEqual([
        { text: "Uh ", begin: 0, end: 0.5 },
        { text: "일단은 ", begin: 0.5, end: 1.5 },
        { text: "나", begin: 1.5, end: 2 },
      ]);
    });
  });
});
