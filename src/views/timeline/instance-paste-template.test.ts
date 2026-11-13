import { describe, expect, it } from "vitest";
import { createGroup, createLine } from "@/test/factories";
import { instancePasteClipboard } from "@/views/timeline/instance-paste-template";

describe("instancePasteClipboard", () => {
  describe("regressions", () => {
    it("regression: starts at the instance start when its first line is line-synced", () => {
      const lines = [
        createLine({ id: "a", text: "oh", begin: 10, end: 11, groupId: "g", instanceIdx: 0, templateLineIdx: 0 }),
        createLine({
          id: "b",
          text: "go",
          words: [{ text: "go", begin: 12, end: 13 }],
          groupId: "g",
          instanceIdx: 0,
          templateLineIdx: 1,
        }),
      ];
      const clipboard = {
        entries: [
          {
            word: { id: "w1", text: "go", sep: "", begin: 12, end: 13, joinsNext: true },
            lineOffset: 1,
            trackType: "word" as const,
          },
        ],
        sourceInstance: { groupId: "g", instanceIdx: 0 },
      };

      const placed = instancePasteClipboard(lines, [createGroup({ id: "g" })], clipboard);

      expect(placed.entries.map(({ word, lineOffset }) => [word.text, word.begin, lineOffset])).toEqual([
        ["oh", 0, 0],
        ["go", 2, 1],
      ]);
    });
  });

  it("carries each syllable's reading", () => {
    const source = createLine({
      id: "a",
      text: "海",
      words: [{ text: "海", begin: 4, end: 5 }],
      groupId: "g",
      instanceIdx: 0,
    });
    const [sea] = source.words ?? [];
    const transliteration = {
      language: "ja-Latn",
      origin: "manual" as const,
      sourceFingerprint: "",
      main: { text: "umi", pieces: { [sea.id]: { text: "umi" } } },
    };
    const lines = [{ ...source, templateLineIdx: 0, languages: { transliteration } }];
    const clipboard = { entries: [], sourceInstance: { groupId: "g", instanceIdx: 0 } };

    const placed = instancePasteClipboard(lines, [createGroup({ id: "g" })], clipboard);

    expect(placed.entries.map((entry) => entry.piece)).toEqual([{ text: "umi" }]);
  });
});
