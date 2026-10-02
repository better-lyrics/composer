import type { WordSelection } from "@/domain/selection/model";
import { createLine, createWord } from "@/test/factories";
import { selectedBannerInstance } from "@/views/timeline/selected-banner";
import { getWordsInInstance } from "@/views/timeline/utils";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const chorusLine = (id: string, instanceIdx: number, begin: number) =>
  createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
  });

const lineSyncedChorus = (id: string, instanceIdx: number, begin: number) =>
  createLine({ id, text: "go now", groupId: "g2", instanceIdx, templateLineIdx: 0, begin, end: begin + 2 });

const verse = createLine({ id: "v", text: "verse", words: [createWord({ text: "verse", begin: 5, end: 6 })] });
const lines = [chorusLine("a", 0, 10), verse, chorusLine("b", 1, 40)];

// -- Tests --------------------------------------------------------------------

describe("selectedBannerInstance", () => {
  it("returns the instance whose banner selected all of its words", () => {
    const selection = getWordsInInstance(lines, "g1", 1);

    expect(selectedBannerInstance(lines, selection)).toEqual({ groupId: "g1", instanceIdx: 1 });
  });

  it("returns null for a partial selection inside an instance", () => {
    const selection = getWordsInInstance(lines, "g1", 1).slice(0, 1);

    expect(selectedBannerInstance(lines, selection)).toBeNull();
  });

  describe("edge cases", () => {
    it("returns null for an empty selection", () => {
      expect(selectedBannerInstance(lines, [])).toBeNull();
    });

    it("returns null for a selection on a line outside any group", () => {
      const selection: WordSelection[] = [{ lineId: "v", lineIndex: 1, wordIndex: 0, type: "word" }];

      expect(selectedBannerInstance(lines, selection)).toBeNull();
    });

    it("returns null when the selection also holds a word outside the instance", () => {
      const selection: WordSelection[] = [
        ...getWordsInInstance(lines, "g1", 0),
        { lineId: "v", lineIndex: 1, wordIndex: 0, type: "word" },
      ];

      expect(selectedBannerInstance(lines, selection)).toBeNull();
    });

    it("returns null for a selection of the same size that spans two instances", () => {
      const selection: WordSelection[] = [getWordsInInstance(lines, "g1", 0)[0], getWordsInInstance(lines, "g1", 1)[0]];

      expect(selectedBannerInstance(lines, selection)).toBeNull();
    });
  });

  describe("regressions", () => {
    it("regression: returns a line-synced instance whose banner was clicked", () => {
      const syncedLines = [lineSyncedChorus("s0", 0, 10), verse, lineSyncedChorus("s1", 1, 40)];
      const selection = getWordsInInstance(syncedLines, "g2", 1);

      expect(selection).toEqual([{ lineId: "s1", lineIndex: 2, wordIndex: 0, type: "word" }]);
      expect(selectedBannerInstance(syncedLines, selection)).toEqual({ groupId: "g2", instanceIdx: 1 });
    });

    it("regression: counts a line-synced row as one word next to a word-synced row", () => {
      const mixed = [
        chorusLine("a", 0, 10),
        createLine({ id: "b", text: "la la", groupId: "g1", instanceIdx: 0, templateLineIdx: 1, begin: 12, end: 14 }),
      ];
      const selection = getWordsInInstance(mixed, "g1", 0);

      expect(selection.map((word) => `${word.lineId}:${word.wordIndex}`)).toEqual(["a:0", "a:1", "b:0"]);
      expect(selectedBannerInstance(mixed, selection)).toEqual({ groupId: "g1", instanceIdx: 0 });
    });
  });

  describe("edge cases · untimed rows", () => {
    it("selects nothing for an instance whose lines have no timing", () => {
      const untimed = [createLine({ id: "u", text: "go", groupId: "g3", instanceIdx: 0, templateLineIdx: 0 })];

      expect(getWordsInInstance(untimed, "g3", 0)).toEqual([]);
      expect(selectedBannerInstance(untimed, [])).toBeNull();
    });
  });
});
