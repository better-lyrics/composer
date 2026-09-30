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
});
