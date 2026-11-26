/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addGroup } from "@/domain/commands/group-edits";
import { mergeSyllableGroup } from "@/domain/commands/word-edits";
import type { TransliterationTrack } from "@/domain/language/model";
import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { newWordId } from "@/domain/word/id";
import { useProjectStore } from "@/stores/project";

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
      { id: newWordId(), text: "Uh", sep: " ", begin: 0, end: 0.5 },
      { id: newWordId(), text: "일", sep: "", begin: 0.5, end: 0.8, syllableGroupId: "g1" },
      { id: newWordId(), text: "단은", sep: " ", begin: 0.8, end: 1.5, syllableGroupId: "g1" },
      { id: newWordId(), text: "나", sep: "", begin: 1.5, end: 2 },
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
      useProjectStore.getState().restoreLyrics({ lines: [splitKoreanLine()] });

      useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [1]));

      const merged = lineById("line-1");
      expect(timedSyllables(mainTrack(merged!)).map((word) => word.text + word.sep)).toEqual(["Uh ", "일단은 ", "나"]);
      expect(timedSyllables(mainTrack(merged!))[1].transliteration).toBe("ildan eun");
      expect(merged?.transliteration).toEqual(track);
    });

    it("regression: keeps the last syllable's joiner on the merged word (#283)", () => {
      const line = splitKoreanLine({
        words: [
          {
            id: "w1",
            text: "Uh",
            sep: " ",
            begin: 0,
            end: 0.5,
            transliteration: "Uh",
            transliterationJoinerAfter: "  ",
          },
          {
            id: "w2",
            text: "일",
            sep: "",
            begin: 0.5,
            end: 0.8,
            syllableGroupId: "g1",
            transliteration: "il",
            transliterationJoinerAfter: "",
          },
          {
            id: "w3",
            text: "단은",
            sep: " ",
            begin: 0.8,
            end: 1.5,
            syllableGroupId: "g1",
            transliteration: "dan eun",
            transliterationJoinerAfter: "  ",
          },
          { id: "w4", text: "나", sep: "", begin: 1.5, end: 2, transliteration: "na" },
        ],
      });
      useProjectStore.getState().restoreLyrics({ lines: [line] });

      useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [2]));

      const mergedWord = lineById("line-1")?.words?.[1];
      expect(mergedWord?.transliteration).toBe("ildan eun");
      expect(mergedWord?.transliterationJoinerAfter).toBe("  ");
    });

    it("regression: merges a background group from its aligned pieces (#283)", () => {
      useProjectStore.getState().restoreLyrics({
        lines: [
          splitKoreanLine({
            backgroundText: "그|래 yeah",
            backgroundWords: [
              { id: "w5", text: "그", sep: "", begin: 2, end: 2.2, syllableGroupId: "b1" },
              { id: "w6", text: "래", sep: " ", begin: 2.2, end: 2.5, syllableGroupId: "b1" },
              { id: "w7", text: "yeah", sep: "", begin: 2.5, end: 3 },
            ],
          }),
        ],
      });

      useProjectStore.getState().commit(mergeSyllableGroup("line-1", "backgroundWords", [0]));

      const merged = lineById("line-1");
      expect(timedSyllables(backgroundTrack(merged!)).map((word) => word.text + word.sep)).toEqual(["그래 ", "yeah"]);
      expect(timedSyllables(backgroundTrack(merged!)).map((word) => word.transliteration)).toEqual(["geurae", "yeah"]);
      expect(merged?.transliteration).toEqual(track);
    });
  });

  describe("cross-field interactions", () => {
    it("merges a linked sibling with its own aligned pieces", () => {
      useProjectStore
        .getState()
        .commit(addGroup({ id: "chorus", label: "Chorus", color: "#f472b6", templateVersion: 1 }));
      const linked = { groupId: "chorus", templateLineIdx: 0 };
      useProjectStore.getState().restoreLyrics({
        lines: [
          splitKoreanLine({ id: "a0", instanceIdx: 0, ...linked }),
          splitKoreanLine({
            id: "a1",
            instanceIdx: 1,
            ...linked,
            words: [
              { id: "w8", text: "Uh", sep: " ", begin: 10, end: 10.5 },
              { id: "w9", text: "일", sep: "", begin: 10.5, end: 10.8, syllableGroupId: "g2" },
              { id: "w10", text: "단은", sep: " ", begin: 10.8, end: 11.5, syllableGroupId: "g2" },
              { id: "w11", text: "나", sep: "", begin: 11.5, end: 12 },
            ],
            transliteration: { ...track, text: "Uh  ilttan eun  na" },
          }),
        ],
      });

      useProjectStore.getState().commit(mergeSyllableGroup("a0", "words", [1]));

      expect(timedSyllables(mainTrack(lineById("a0")!))[1].transliteration).toBe("ildan eun");
      expect(timedSyllables(mainTrack(lineById("a1")!)).map((word) => word.text + word.sep)).toEqual([
        "Uh ",
        "일단은 ",
        "나",
      ]);
      expect(timedSyllables(mainTrack(lineById("a1")!))[1].transliteration).toBe("ilttan eun");
    });
  });

  describe("edge cases", () => {
    it("merges a line without a transliteration track as before", () => {
      const { transliteration: _track, ...line } = splitKoreanLine();
      useProjectStore.getState().restoreLyrics({ lines: [line] });

      useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [1]));

      expect(timedSyllables(mainTrack(lineById("line-1")!))).toEqual([
        { text: "Uh", sep: " ", begin: 0, end: 0.5 },
        { text: "일단은", sep: " ", begin: 0.5, end: 1.5 },
        { text: "나", sep: "", begin: 1.5, end: 2 },
      ]);
    });
  });
});
