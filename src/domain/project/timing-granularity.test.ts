import { fieldsOfLine, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { timingGranularityOf } from "@/domain/project/timing-granularity";
import { describe, expect, it } from "vitest";

const wordSynced: LyricLine = lineFromFields({
  id: "w",
  text: "Hello world",
  agentId: "v1",
  words: [
    { id: "w1", text: "Hello", sep: " ", begin: 1, end: 1.5, joinsNext: false },
    { id: "w2", text: "world", sep: "", begin: 1.5, end: 2, joinsNext: false },
  ],
});
const lineSynced: LyricLine = lineFromFields({ id: "l", text: "Line only", agentId: "v1", begin: 3, end: 4 });
const untimed: LyricLine = lineFromFields({ id: "u", text: "Never synced", agentId: "v1" });

describe("timingGranularityOf", () => {
  describe("happy paths", () => {
    it("is word when any line carries word timing", () => {
      expect(timingGranularityOf([lineSynced, wordSynced])).toBe("word");
    });

    it("is line when no line carries word timing", () => {
      expect(timingGranularityOf([lineSynced, untimed])).toBe("line");
    });
  });

  describe("edge cases", () => {
    it("is line for an empty project", () => {
      expect(timingGranularityOf([])).toBe("line");
    });

    it("ignores background word timing on an otherwise line-synced line", () => {
      const withBackgroundWords: LyricLine = lineFromFields({
        ...fieldsOfLine(lineSynced),
        backgroundText: "(yeah)",
        backgroundWords: [{ id: "w3", text: "(yeah)", sep: "", begin: 3.5, end: 4, joinsNext: false }],
      });
      expect(timingGranularityOf([withBackgroundWords])).toBe("line");
    });
  });

  describe("invariants", () => {
    it("does not depend on line order", () => {
      expect(timingGranularityOf([wordSynced, untimed, lineSynced])).toBe(
        timingGranularityOf([untimed, lineSynced, wordSynced]),
      );
    });
  });
});
