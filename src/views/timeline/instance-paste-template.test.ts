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
        entries: [{ word: { text: "go", begin: 12, end: 13 }, lineOffset: 1, trackType: "word" as const }],
        sourceInstance: { groupId: "g", instanceIdx: 0 },
      };

      const placed = instancePasteClipboard(lines, [createGroup({ id: "g" })], clipboard);

      expect(placed.entries.map(({ word, lineOffset }) => [word.text, word.begin, lineOffset])).toEqual([
        ["oh", 0, 0],
        ["go", 2, 1],
      ]);
    });
  });
});
